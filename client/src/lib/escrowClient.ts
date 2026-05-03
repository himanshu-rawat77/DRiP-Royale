import bs58 from "bs58";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { getHeliusRpcUrl } from "@shared/heliusRpc";
import type { GameCard } from "./types";
import { getPhantomProvider } from "./phantomWallet";

/** Same deposit tx submitted twice (RPC retries or Strict Mode) lands once; second submit returns AlreadyProcessed. */
function isAlreadyProcessedSendError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (/already been processed/i.test(msg)) return true;
  try {
    return JSON.stringify(e).includes("AlreadyProcessed");
  } catch {
    return false;
  }
}

function versionedTxSignatureBase58(tx: VersionedTransaction): string {
  const sig = tx.signatures[0];
  if (!sig || sig.every((b) => b === 0)) {
    throw new Error("Signed transaction has no primary signature");
  }
  return bs58.encode(sig);
}

async function sendSignedVersionedOnce(
  connection: Connection,
  signed: VersionedTransaction
): Promise<string> {
  const serialized = signed.serialize();
  const sigFromTx = versionedTxSignatureBase58(signed);
  try {
    return await connection.sendRawTransaction(serialized, {
      maxRetries: 0,
      skipPreflight: false,
    });
  } catch (e) {
    if (isAlreadyProcessedSendError(e)) return sigFromTx;
    throw e;
  }
}

const escrowDepositChains = new Map<string, Promise<void>>();

function clientHeliusRpcUrl(): string {
  const env = import.meta.env;
  return getHeliusRpcUrl({
    apiKey:
      (env.VITE_HELIUS_API_KEY as string | undefined) ||
      (env.NEXT_PUBLIC_HELIUS_API_KEY as string | undefined),
    network:
      (env.VITE_SOLANA_NETWORK as string | undefined) ||
      (env.NEXT_PUBLIC_SOLANA_NETWORK as string | undefined),
  });
}

export async function fetchEscrowConfig(): Promise<{ enabled: boolean; custodyPubkey: string | null }> {
  const res = await fetch("/api/escrow/config");
  if (!res.ok) return { enabled: false, custodyPubkey: null };
  return res.json();
}

/**
 * Transfer each deck cNFT to custody, then notify server (DAS-verified).
 * Serialized per room+player so parallel effect runs / Strict Mode cannot double-submit the same tx.
 */
export async function ensureEscrowDepositsForMatch(opts: {
  roomId: string;
  playerId: string;
  walletAddress: string;
  deck: GameCard[];
  custodyPubkey: string;
}): Promise<void> {
  const chainKey = `${opts.roomId}:${opts.playerId}`;
  const existing = escrowDepositChains.get(chainKey);
  if (existing) {
    await existing;
    return;
  }

  const promise = runEscrowDeposits(opts);
  escrowDepositChains.set(chainKey, promise);
  try {
    await promise;
  } finally {
    if (escrowDepositChains.get(chainKey) === promise) {
      escrowDepositChains.delete(chainKey);
    }
  }
}

async function runEscrowDeposits(opts: {
  roomId: string;
  playerId: string;
  walletAddress: string;
  deck: GameCard[];
  custodyPubkey: string;
}): Promise<void> {
  const provider = getPhantomProvider();
  if (!provider?.signTransaction) throw new Error("Wallet cannot sign transactions");
  const rpcUrl = clientHeliusRpcUrl();
  const connection = new Connection(rpcUrl, "confirmed");
  const depositedAssetIds: string[] = [];

  try {
    for (const card of opts.deck) {
      const txRes = await fetch("/api/escrow/deposit-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: opts.roomId,
          playerId: opts.playerId,
          walletAddress: opts.walletAddress,
          assetId: card.assetId,
        }),
      });
      const txJson = (await txRes.json().catch(() => ({}))) as { txBase64?: string; error?: string };
      if (!txRes.ok || !txJson.txBase64) {
        throw new Error(txJson.error || "Could not build escrow deposit transaction");
      }

      const txBytes = Uint8Array.from(atob(txJson.txBase64), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = (await provider.signTransaction(tx)) as VersionedTransaction;
      const sig = await sendSignedVersionedOnce(connection, signed);
      await connection.confirmTransaction(sig, "confirmed");

      const recordRes = await fetch("/api/escrow/deposit-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: opts.roomId,
          playerId: opts.playerId,
          walletAddress: opts.walletAddress,
          assetId: card.assetId,
        }),
      });
      const recordJson = (await recordRes.json().catch(() => ({}))) as { error?: string };
      if (!recordRes.ok) throw new Error(recordJson.error || "Could not record deposited asset");
      depositedAssetIds.push(card.assetId);
    }

    const res = await fetch("/api/escrow/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: opts.roomId,
        playerId: opts.playerId,
        walletAddress: opts.walletAddress,
        assetIds: opts.deck.map((c) => c.assetId),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Escrow confirmation failed");
  } catch (error) {
    if (depositedAssetIds.length > 0) {
      const rollbackRes = await fetch("/api/escrow/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: opts.roomId,
          playerId: opts.playerId,
          walletAddress: opts.walletAddress,
        }),
      });
      const rollbackJson = (await rollbackRes.json().catch(() => ({}))) as {
        ok?: boolean;
        rolledBack?: string[];
        failed?: Array<{ assetId: string; error: string }>;
      };
      const failedCount = rollbackJson.failed?.length ?? 0;
      if (!rollbackRes.ok || failedCount > 0) {
        throw new Error(
          `Escrow deposit failed and rollback was partial (${failedCount} assets still in custody).`
        );
      }
    }
    throw error;
  }
}
