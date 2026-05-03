import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createTree, mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { generateSigner, signerIdentity, percentAmount, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { getCustodyKeypair } from "./custody-keypair";
import { getServerHeliusRpcUrl } from "./helius-rpc";

export async function bootstrapCollectionNft(input: {
  name: string;
  symbol?: string | null;
  metadataUri: string;
  sellerFeePercent?: number;
}): Promise<{ collectionMint: string; txSignature: string }> {
  const custody = getCustodyKeypair();
  if (!custody) throw new Error("CUSTODY_PRIVATE_KEY is required to create collection");

  const umi = createUmi(getServerHeliusRpcUrl()).use(mplTokenMetadata());
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(custody));
  umi.use(signerIdentity(signer));
  await ensureSignerCanPay(custody.publicKey.toBase58(), getServerHeliusRpcUrl());

  const collectionMint = generateSigner(umi);
  const tx = await createNft(umi, {
    mint: collectionMint,
    symbol: input.symbol?.trim() || "DRIP",
    name: input.name.trim(),
    uri: input.metadataUri.trim(),
    sellerFeeBasisPoints: percentAmount(Math.max(0, Math.min(10, input.sellerFeePercent ?? 0))),
    isCollection: true,
  }).sendAndConfirm(umi);

  return {
    collectionMint: collectionMint.publicKey.toString(),
    txSignature: bs58.encode(tx.signature),
  };
}

export async function bootstrapMerkleTree(input?: {
  maxDepth?: number;
  maxBufferSize?: number;
}): Promise<{ merkleTree: string; txSignature: string }> {
  const custody = getCustodyKeypair();
  if (!custody) throw new Error("CUSTODY_PRIVATE_KEY is required to create merkle tree");

  const umi = createUmi(getServerHeliusRpcUrl()).use(mplBubblegum());
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(custody));
  umi.use(signerIdentity(signer));
  await ensureSignerCanPay(custody.publicKey.toBase58(), getServerHeliusRpcUrl());

  const merkleTree = generateSigner(umi);
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: input?.maxDepth ?? 14,
    maxBufferSize: input?.maxBufferSize ?? 64,
  });
  const tx = await builder.sendAndConfirm(umi);

  return {
    merkleTree: merkleTree.publicKey.toString(),
    txSignature: bs58.encode(tx.signature),
  };
}

async function ensureSignerCanPay(wallet: string, rpcUrl: string): Promise<void> {
  const conn = new Connection(rpcUrl, "confirmed");
  const lamports = await conn.getBalance(new (await import("@solana/web3.js")).PublicKey(wallet), "confirmed");
  if (lamports > 0.001 * LAMPORTS_PER_SOL) return;

  const network = String(
    process.env.SOLANA_NETWORK ||
      process.env.NEXT_PUBLIC_SOLANA_NETWORK ||
      process.env.VITE_SOLANA_NETWORK ||
      "devnet"
  ).toLowerCase();

  if (network === "devnet") {
    try {
      const sig = await conn.requestAirdrop(
        new (await import("@solana/web3.js")).PublicKey(wallet),
        0.05 * LAMPORTS_PER_SOL
      );
      await conn.confirmTransaction(sig, "confirmed");
      const after = await conn.getBalance(new (await import("@solana/web3.js")).PublicKey(wallet), "confirmed");
      if (after > 0) return;
    } catch {
      // fallthrough to explicit error
    }
  }

  throw new Error(
    `[campaign-bootstrap] Signer wallet ${wallet} has insufficient SOL for fees on ${network}. ` +
      `Fund this wallet and retry.`
  );
}
