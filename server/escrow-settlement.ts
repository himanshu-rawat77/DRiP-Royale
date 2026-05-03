import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { mplBubblegum, getAssetWithProof, transfer } from "@metaplex-foundation/mpl-bubblegum";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import type { LocalMatch } from "../shared/matchEngine";
import { getCustodyKeypair } from "./custody-keypair";
import { getServerHeliusRpcUrl } from "./helius-rpc";

function collectAssetIds(match: LocalMatch, slot: "player1" | "player2"): string[] {
  const p = match[slot];
  const all = [...p.deck, ...p.hand, ...p.won, ...p.pile];
  return Array.from(new Set(all.map((c) => c.assetId)));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type EscrowSettlementResult = {
  ok: boolean;
  transferredToWinner: string[];
  transferredToLoser: string[];
  failed: Array<{ assetId: string; target: "winner" | "loser"; error: string }>;
};

/**
 * Return each staked cNFT to the match outcome owner (custody signs).
 */
export async function settleEscrowAfterMatch(
  match: LocalMatch,
  playerIds: [string, string],
  playerWallets: Partial<Record<string, string>>
): Promise<EscrowSettlementResult> {
  if (!match.winner) {
    return { ok: true, transferredToWinner: [], transferredToLoser: [], failed: [] };
  }
  const custody = getCustodyKeypair() ;
  if (!custody) {
    return { ok: false, transferredToWinner: [], transferredToLoser: [], failed: [] };
  }

  const wA = playerWallets[playerIds[0]];
  const wB = playerWallets[playerIds[1]];
  if (!wA || !wB) {
    console.error("[escrow] Missing wallet addresses for settlement");
    return {
      ok: false,
      transferredToWinner: [],
      transferredToLoser: [],
      failed: [
        {
          assetId: "wallet-mapping",
          target: "winner",
          error: "Missing wallet addresses for settlement",
        },
      ],
    };
  }

  const rpc = getServerHeliusRpcUrl();
  const umi = createUmi(rpc).use(mplBubblegum()).use(dasApi());
  umi.use(keypairIdentity(fromWeb3JsKeypair(custody)));

  const winnerSlot = match.winner;
  const loserSlot: "player1" | "player2" = winnerSlot === "player1" ? "player2" : "player1";
  const winnerWallet = winnerSlot === "player1" ? wA : wB;
  const loserWallet = loserSlot === "player1" ? wA : wB;

  const toWinner = collectAssetIds(match, winnerSlot);
  const toLoser = collectAssetIds(match, loserSlot);
  const transferredToWinner: string[] = [];
  const transferredToLoser: string[] = [];
  const failed: Array<{ assetId: string; target: "winner" | "loser"; error: string }> = [];

  for (const assetId of toWinner) {
    try {
      const proof = await getAssetWithProof(umi as any, publicKey(assetId));
      const tx = await transfer(umi as any, {
        ...proof,
        leafOwner: umi.identity,
        newLeafOwner: publicKey(winnerWallet),
      }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
      transferredToWinner.push(assetId);
      console.log(`[escrow] transfer to winner ok ${assetId}`, tx);
    } catch (e) {
      console.error(`[escrow] transfer to winner failed ${assetId}`, e);
      failed.push({
        assetId,
        target: "winner",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await sleep(400);
  }

  for (const assetId of toLoser) {
    try {
      const proof = await getAssetWithProof(umi as any, publicKey(assetId));
      const tx = await transfer(umi as any, {
        ...proof,
        leafOwner: umi.identity,
        newLeafOwner: publicKey(loserWallet),
      }).sendAndConfirm(umi as any, { confirm: { commitment: "confirmed" } });
      transferredToLoser.push(assetId);
      console.log(`[escrow] transfer to loser ok ${assetId}`, tx);
    } catch (e) {
      console.error(`[escrow] transfer to loser failed ${assetId}`, e);
      failed.push({
        assetId,
        target: "loser",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await sleep(400);
  }

  const ok = failed.length === 0;
  if (ok) {
    console.log(`[escrow] settlement finished for match ${match.id}`);
  } else {
    console.error(
      `[escrow] settlement incomplete for match ${match.id}. failed=${failed.length}`,
      failed
    );
  }
  return { ok, transferredToWinner, transferredToLoser, failed };
}
