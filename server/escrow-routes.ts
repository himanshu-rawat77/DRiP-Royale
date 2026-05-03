import express, { Router } from "express";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createNoopSigner, keypairIdentity, publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { mplBubblegum, getAssetWithProof, transfer } from "@metaplex-foundation/mpl-bubblegum";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { fromWeb3JsKeypair, toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { custodyEscrowEnabled, getCustodyKeypair, getCustodyPubkeyBase58 } from "./custody-keypair";
import { getEscrowRegistrar } from "./escrow-registry";
import { getServerHeliusRpcUrl } from "./helius-rpc";
import { verifyCompressedAssetsInCustody } from "./escrow-verify";

type DepositSession = {
  roomId: string;
  playerId: string;
  walletAddress: string;
  depositedAssetIds: string[];
  status: "depositing" | "confirmed" | "failed" | "rolled_back";
  updatedAt: number;
};

const depositSessions = new Map<string, DepositSession>();

function sessionKey(roomId: string, playerId: string) {
  return `${roomId}:${playerId}`;
}

export function createEscrowRouter(): Router {
  const r = Router();
  // Vite dev mounts this router through a connect-style middleware stack where
  // `res.json()` may not exist. We still want `req.body` parsing to work.
  r.use(express.json({ limit: "512kb" }));

  const sendJson = (res: any, status: number, payload: any) => {
    // Express responses
    if (typeof res?.status === "function" && typeof res?.json === "function") {
      res.status(status).json(payload);
      return;
    }

    // Connect / bare Node responses
    if (typeof res?.writeHead === "function") {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    // Fallback
    res.statusCode = status;
    if (typeof res?.setHeader === "function") res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };

  r.get("/config", (_req, res) => {
    const enabled = custodyEscrowEnabled();
    sendJson(res, 200, {
      enabled,
      custodyPubkey: enabled ? getCustodyPubkeyBase58() : null,
    });
  });

  r.post("/deposit-tx", async (req, res) => {
    if (!custodyEscrowEnabled()) {
      sendJson(res, 400, { error: "Custody escrow is not configured" });
      return;
    }

    const body = req.body as {
      roomId?: string;
      playerId?: string;
      walletAddress?: string;
      assetId?: string;
    };
    const { walletAddress, assetId } = body;
    if (!walletAddress || !assetId) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }

    const custody = getCustodyPubkeyBase58();
    if (!custody) {
      sendJson(res, 500, { error: "Custody misconfigured" });
      return;
    }

    try {
      const playerPk = publicKey(walletAddress);
      const noop = createNoopSigner(playerPk);
      const umi = createUmi(getServerHeliusRpcUrl())
        .use(mplBubblegum())
        .use(dasApi())
        .use(signerIdentity(noop));

      const proof = await getAssetWithProof(umi as any, publicKey(assetId));
      const built = await transfer(umi as any, {
        ...proof,
        leafOwner: noop,
        newLeafOwner: publicKey(custody),
      }).buildAndSign(umi as any);

      const tx = toWeb3JsTransaction(built as any);
      const txBase64 = Buffer.from(tx.serialize()).toString("base64");
      sendJson(res, 200, { txBase64 });
    } catch (e) {
      console.error("[escrow] deposit-tx build failed", {
        assetId,
        walletAddress,
        error: e instanceof Error ? e.message : String(e),
      });
      sendJson(res, 400, { error: e instanceof Error ? e.message : "Could not build deposit transaction" });
    }
  });

  r.post("/deposit-record", (req, res) => {
    const body = req.body as {
      roomId?: string;
      playerId?: string;
      walletAddress?: string;
      assetId?: string;
    };
    const { roomId, playerId, walletAddress, assetId } = body;
    if (!roomId || !playerId || !walletAddress || !assetId) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }

    const reg = getEscrowRegistrar();
    if (!reg || !reg.roomHasPlayer(roomId, playerId)) {
      sendJson(res, 400, { error: "Room not found or player not in room" });
      return;
    }

    const key = sessionKey(roomId, playerId);
    const existing = depositSessions.get(key);
    const depositedAssetIds = existing?.depositedAssetIds ?? [];
    if (!depositedAssetIds.includes(assetId)) depositedAssetIds.push(assetId);
    depositSessions.set(key, {
      roomId,
      playerId,
      walletAddress,
      depositedAssetIds,
      status: "depositing",
      updatedAt: Date.now(),
    });
    sendJson(res, 200, { ok: true, depositedCount: depositedAssetIds.length });
  });

  r.post("/rollback", async (req, res) => {
    if (!custodyEscrowEnabled()) {
      sendJson(res, 400, { error: "Custody escrow is not configured" });
      return;
    }
    const body = req.body as {
      roomId?: string;
      playerId?: string;
      walletAddress?: string;
    };
    const { roomId, playerId, walletAddress } = body;
    if (!roomId || !playerId || !walletAddress) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }

    const key = sessionKey(roomId, playerId);
    const session = depositSessions.get(key);
    if (!session) {
      sendJson(res, 200, { ok: true, rolledBack: [], failed: [] });
      return;
    }
    if (session.walletAddress !== walletAddress) {
      sendJson(res, 400, { error: "Wallet mismatch for rollback session" });
      return;
    }

    const custody = getCustodyKeypair();
    if (!custody) {
      sendJson(res, 500, { error: "Custody misconfigured" });
      return;
    }

    const umi = createUmi(getServerHeliusRpcUrl()).use(mplBubblegum()).use(dasApi());
    umi.use(keypairIdentity(fromWeb3JsKeypair(custody)));

    const rolledBack: string[] = [];
    const failed: Array<{ assetId: string; error: string }> = [];
    const remaining: string[] = [];

    for (const assetId of session.depositedAssetIds) {
      try {
        const proof = await getAssetWithProof(umi as any, publicKey(assetId));
        await transfer(umi as any, {
          ...proof,
          leafOwner: umi.identity,
          newLeafOwner: publicKey(walletAddress),
        }).sendAndConfirm(umi as any, { confirm: { commitment: "confirmed" } });
        rolledBack.push(assetId);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failed.push({ assetId, error: message });
        remaining.push(assetId);
      }
    }

    if (remaining.length === 0) {
      depositSessions.set(key, {
        ...session,
        depositedAssetIds: [],
        status: "rolled_back",
        updatedAt: Date.now(),
      });
    } else {
      depositSessions.set(key, {
        ...session,
        depositedAssetIds: remaining,
        status: "failed",
        updatedAt: Date.now(),
      });
    }

    sendJson(res, 200, {
      ok: failed.length === 0,
      rolledBack,
      failed,
    });
  });

  r.post("/confirm", async (req, res) => {
    if (!custodyEscrowEnabled()) {
      sendJson(res, 400, { error: "Custody escrow is not configured" });
      return;
    }
    const body = req.body as {
      roomId?: string;
      playerId?: string;
      walletAddress?: string;
      assetIds?: string[];
    };
    const { roomId, playerId, walletAddress, assetIds } = body;
    if (!roomId || !playerId || !walletAddress || !Array.isArray(assetIds) || assetIds.length === 0) {
      sendJson(res, 400, { error: "Invalid body" });
      return;
    }

    const reg = getEscrowRegistrar();
    if (!reg || !reg.roomHasPlayer(roomId, playerId)) {
      sendJson(res, 400, { error: "Room not found or player not in room" });
      return;
    }

    const custody = getCustodyPubkeyBase58();
    if (!custody) {
      sendJson(res, 500, { error: "Custody misconfigured" });
      return;
    }

    const verify = await verifyCompressedAssetsInCustody(getServerHeliusRpcUrl(), custody, assetIds);
    if (!verify.ok) {
      sendJson(res, 400, { error: verify.error });
      return;
    }

    const key = sessionKey(roomId, playerId);
    const session = depositSessions.get(key);
    if (session) {
      depositSessions.set(key, {
        ...session,
        status: "confirmed",
        depositedAssetIds: [],
        updatedAt: Date.now(),
      });
    }

    reg.markDepositReady(roomId, playerId, walletAddress);
    sendJson(res, 200, { ok: true });
  });

  return r;
}
