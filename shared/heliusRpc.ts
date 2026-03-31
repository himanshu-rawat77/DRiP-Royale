/**
 * Shared Helius JSON-RPC URL (DAS + Solana) for client and server.
 */
export function getHeliusRpcUrl(parts: {
  apiKey: string | undefined;
  network: string | undefined;
}): string {
  const network = parts.network === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const base =
    network === "mainnet-beta"
      ? "https://mainnet.helius-rpc.com"
      : "https://devnet.helius-rpc.com";
  const key = parts.apiKey?.trim();
  return key && key !== "devnet" ? `${base}/?api-key=${key}` : base;
}
