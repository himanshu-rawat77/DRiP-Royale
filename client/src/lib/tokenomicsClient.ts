export interface TokenomicsConfig {
  tokenSymbol: string;
  totalSupply: number;
  decimals: number;
  mintAuthorityRevoked: boolean;
  allocations: {
    team: number;
    community: number;
    ecosystem: number;
    platformReserve: number;
    liquidity: number;
  };
}

export interface RoyaleWalletState {
  wallet: string;
  royaleBalance: number;
  challengeTickets: number;
}

export async function fetchTokenomicsConfig(): Promise<TokenomicsConfig> {
  const res = await fetch("/api/tokenomics/config");
  if (!res.ok) throw new Error("Failed to load tokenomics config");
  return res.json() as Promise<TokenomicsConfig>;
}

export async function fetchRoyaleWalletState(wallet: string): Promise<RoyaleWalletState> {
  const res = await fetch(`/api/tokenomics/balance/${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error("Failed to load ROYALE balance");
  return res.json() as Promise<RoyaleWalletState>;
}

export async function purchaseChallengeTickets(wallet: string, count: number): Promise<RoyaleWalletState> {
  const res = await fetch("/api/tokenomics/tickets/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      ticketCount: count,
      royaleCostPerTicket: 5,
    }),
  });
  const data = (await res.json()) as {
    error?: string;
    royaleBalance?: number;
    challengeTickets?: number;
  };
  if (!res.ok) throw new Error(data.error ?? "Ticket purchase failed");
  return {
    wallet,
    royaleBalance: data.royaleBalance ?? 0,
    challengeTickets: data.challengeTickets ?? 0,
  };
}

export async function airdropRoyale(wallet: string): Promise<RoyaleWalletState> {
  let res = await fetch("/api/tokenomics/airdrop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (res.status === 404) {
    // Backward-compatible fallback when dev server has not picked up /airdrop yet.
    res = await fetch("/api/tokenomics/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, amount: 100 }),
    });
  }
  const data = (await res.json()) as {
    error?: string;
    royaleBalance?: number;
  };
  if (!res.ok) throw new Error(data.error ?? "Airdrop failed");
  const state = await fetchRoyaleWalletState(wallet);
  return {
    wallet,
    royaleBalance: data.royaleBalance ?? state.royaleBalance,
    challengeTickets: state.challengeTickets,
  };
}
