import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

let cached: Keypair | null | undefined;

export function getCustodyKeypair(): Keypair | null {
  if (cached !== undefined) return cached;
  const secret = process.env.CUSTODY_PRIVATE_KEY?.trim();
  if (!secret) {
    cached = null;
    return null;
  }
  try {
    const secretKey = bs58.decode(secret);
    if (secretKey.length !== 64 && secretKey.length !== 32) {
      console.error("[custody] CUSTODY_PRIVATE_KEY must decode to 32 or 64 bytes");
      cached = null;
      return null;
    }
    cached = Keypair.fromSecretKey(secretKey);
  } catch (e) {
    console.error("[custody] Failed to parse CUSTODY_PRIVATE_KEY", e);
    cached = null;
  }
  return cached;
}

export function custodyEscrowEnabled(): boolean {
  return getCustodyKeypair() !== null;
}

export function getCustodyPubkeyBase58(): string | null {
  const k = getCustodyKeypair();
  return k ? k.publicKey.toBase58() : null;
}
