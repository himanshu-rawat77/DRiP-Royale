import type { VersionedTransaction } from "@solana/web3.js";
import { getHeliusRpcUrl } from "@shared/heliusRpc";
import type { GameCard } from "./types";
import { getPhantomProvider } from "./phantomWallet";

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
 */
export async function ensureEscrowDepositsForMatch(opts: {
  roomId: string;
  playerId: string;
  walletAddress: string;
  deck: GameCard[];
  custodyPubkey: string;
}): Promise<void> {
  // IMPORTANT: keep Metaplex/UMI out of the initial browser bundle.
  // This avoids "white page" crashes when custody escrow is disabled.
  const [
    umiDefaultsMod,
    umiMod,
    bubblegumMod,
    dasMod,
    adaptersMod,
  ] = await Promise.all([
    import("@metaplex-foundation/umi-bundle-defaults"),
    import("@metaplex-foundation/umi"),
    import("@metaplex-foundation/mpl-bubblegum"),
    import("@metaplex-foundation/digital-asset-standard-api"),
    import("@metaplex-foundation/umi-web3js-adapters"),
  ]);

  const { createUmi } = umiDefaultsMod as typeof import("@metaplex-foundation/umi-bundle-defaults");
  const { signerIdentity, publicKey } = umiMod as typeof import("@metaplex-foundation/umi");
  const { mplBubblegum, getAssetWithProof, transfer } =
    bubblegumMod as typeof import("@metaplex-foundation/mpl-bubblegum");
  const { dasApi } = dasMod as typeof import("@metaplex-foundation/digital-asset-standard-api");
  const { toWeb3JsTransaction, fromWeb3JsTransaction } =
    adaptersMod as typeof import("@metaplex-foundation/umi-web3js-adapters");

  const signerPk = publicKey(opts.walletAddress);

  const signer = {
    publicKey: signerPk,
    signMessage: async () => {
      throw new Error("signMessage not available");
    },
    signTransaction: async (tx: any) => {
      const provider = getPhantomProvider();
      if (!provider?.signTransaction) throw new Error("Wallet cannot sign transactions");
      const web3Tx = toWeb3JsTransaction(tx);
      const signed = await provider.signTransaction(web3Tx as unknown as VersionedTransaction);
      return fromWeb3JsTransaction(signed as VersionedTransaction);
    },
    signAllTransactions: async (txs: any[]) => {
      const provider = getPhantomProvider();
      if (!provider?.signTransaction) throw new Error("Wallet cannot sign transactions");

      if (provider?.signAllTransactions) {
        const web3Txs = txs.map((t) => toWeb3JsTransaction(t));
        const signed = await provider.signAllTransactions(web3Txs as any);
        return signed.map((t: any) => fromWeb3JsTransaction(t as VersionedTransaction));
      }

      // Fallback: sign sequentially.
      const out: any[] = [];
      for (const t of txs) {
        out.push(await (signer as any).signTransaction(t));
      }
      return out;
    },
  };

  const umi = createUmi(clientHeliusRpcUrl())
    .use(mplBubblegum())
    .use(dasApi())
    .use(signerIdentity(signer as any));

  for (const card of opts.deck) {
    const proof = await getAssetWithProof(umi as any, publicKey(card.assetId));
    await transfer(umi as any, {
      ...proof,
      leafOwner: signer,
      newLeafOwner: publicKey(opts.custodyPubkey),
    }).sendAndConfirm(umi as any, { confirm: { commitment: "confirmed" } });
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
}
