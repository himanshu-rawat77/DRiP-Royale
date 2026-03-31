import express, { Router } from "express";
import { custodyEscrowEnabled, getCustodyPubkeyBase58 } from "./custody-keypair";
import { getEscrowRegistrar } from "./escrow-registry";
import { getServerHeliusRpcUrl } from "./helius-rpc";
import { verifyCompressedAssetsInCustody } from "./escrow-verify";

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

    reg.markDepositReady(roomId, playerId, walletAddress);
    sendJson(res, 200, { ok: true });
  });

  return r;
}
