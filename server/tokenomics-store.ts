const TOTAL_SUPPLY = 100_000_000;
const DECIMALS = 0;
const STARTER_AIRDROP = 100;

type AllocationKey = "team" | "community" | "ecosystem" | "platformReserve" | "liquidity";

const ALLOCATIONS: Record<AllocationKey, number> = {
  team: 15,
  community: 20,
  ecosystem: 15,
  platformReserve: 30,
  liquidity: 20,
};

const walletBalances = new Map<string, number>();
const spendableTickets = new Map<string, number>();
const starterDistributed = new Set<string>();

function normalizeWallet(wallet: string): string {
  return wallet.trim();
}

function getAllocationAmount(percent: number): number {
  return Math.floor((TOTAL_SUPPLY * percent) / 100);
}

export function getTokenomicsConfig() {
  return {
    tokenSymbol: "ROYALE",
    totalSupply: TOTAL_SUPPLY,
    decimals: DECIMALS,
    mintAuthorityRevoked: true,
    allocations: {
      team: getAllocationAmount(ALLOCATIONS.team),
      community: getAllocationAmount(ALLOCATIONS.community),
      ecosystem: getAllocationAmount(ALLOCATIONS.ecosystem),
      platformReserve: getAllocationAmount(ALLOCATIONS.platformReserve),
      liquidity: getAllocationAmount(ALLOCATIONS.liquidity),
    },
  };
}

export function getRoyaleBalance(wallet: string): number {
  const key = normalizeWallet(wallet);
  if (!starterDistributed.has(key)) {
    starterDistributed.add(key);
    walletBalances.set(key, STARTER_AIRDROP);
  }
  return walletBalances.get(key) ?? 0;
}

export function distributeRoyale(wallet: string, amount: number): { balance: number } {
  const key = normalizeWallet(wallet);
  const current = walletBalances.get(key) ?? 0;
  const next = current + Math.max(0, Math.floor(amount));
  walletBalances.set(key, next);
  return { balance: next };
}

export function spendRoyale(wallet: string, amount: number): { ok: true; balance: number } | { ok: false; error: string } {
  const key = normalizeWallet(wallet);
  const current = walletBalances.get(key) ?? 0;
  const spend = Math.max(0, Math.floor(amount));
  if (current < spend) {
    return { ok: false, error: "Insufficient ROYALE balance" };
  }
  const next = current - spend;
  walletBalances.set(key, next);
  return { ok: true, balance: next };
}

export function addChallengeTickets(wallet: string, count: number): number {
  const key = normalizeWallet(wallet);
  const current = spendableTickets.get(key) ?? 0;
  const next = current + Math.max(0, Math.floor(count));
  spendableTickets.set(key, next);
  return next;
}

export function consumeChallengeTicket(wallet: string): { ok: true; remaining: number } | { ok: false; error: string } {
  const key = normalizeWallet(wallet);
  const current = spendableTickets.get(key) ?? 0;
  if (current <= 0) return { ok: false, error: "No challenge tickets left" };
  const next = current - 1;
  spendableTickets.set(key, next);
  return { ok: true, remaining: next };
}

export function getChallengeTickets(wallet: string): number {
  const key = normalizeWallet(wallet);
  return spendableTickets.get(key) ?? 0;
}
