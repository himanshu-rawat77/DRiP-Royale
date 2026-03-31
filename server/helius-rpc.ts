import { getHeliusRpcUrl } from "../shared/heliusRpc";

export function getServerHeliusRpcUrl(): string {
  const apiKey = process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY;
  const network = process.env.SOLANA_NETWORK || process.env.VITE_SOLANA_NETWORK;
  return getHeliusRpcUrl({ apiKey, network });
}
