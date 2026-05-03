import { dbQuery } from "./db";

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

export async function getRoyaleBalance(wallet: string): Promise<number> {
  const key = normalizeWallet(wallet);
  const upsert = await dbQuery<{
    royale_balance: number;
    starter_distributed: boolean;
  }>(
    `
    insert into token_wallets (wallet, royale_balance, challenge_tickets, starter_distributed, updated_at)
    values ($1, 0, 0, false, now())
    on conflict (wallet) do update set updated_at = now()
    returning royale_balance, starter_distributed
    `,
    [key]
  );
  const row = upsert.rows[0];
  if (!row) return 0;
  if (!row.starter_distributed) {
    const seeded = await dbQuery<{ royale_balance: number }>(
      `
      update token_wallets
      set royale_balance = royale_balance + $2,
          starter_distributed = true,
          updated_at = now()
      where wallet = $1
      returning royale_balance
      `,
      [key, STARTER_AIRDROP]
    );
    return seeded.rows[0]?.royale_balance ?? STARTER_AIRDROP;
  }
  return row.royale_balance;
}

export async function distributeRoyale(wallet: string, amount: number): Promise<{ balance: number }> {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const out = await dbQuery<{ royale_balance: number }>(
    `
    update token_wallets
    set royale_balance = royale_balance + $2,
        updated_at = now()
    where wallet = $1
    returning royale_balance
    `,
    [key, Math.max(0, Math.floor(amount))]
  );
  return { balance: out.rows[0]?.royale_balance ?? 0 };
}

export async function spendRoyale(
  wallet: string,
  amount: number
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const key = normalizeWallet(wallet);
  const current = await getRoyaleBalance(key);
  const spend = Math.max(0, Math.floor(amount));
  if (current < spend) {
    return { ok: false, error: "Insufficient ROYALE balance" };
  }
  const out = await dbQuery<{ royale_balance: number }>(
    `
    update token_wallets
    set royale_balance = royale_balance - $2,
        updated_at = now()
    where wallet = $1
    returning royale_balance
    `,
    [key, spend]
  );
  return { ok: true, balance: out.rows[0]?.royale_balance ?? 0 };
}

export async function addChallengeTickets(wallet: string, count: number): Promise<number> {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const out = await dbQuery<{ challenge_tickets: number }>(
    `
    update token_wallets
    set challenge_tickets = challenge_tickets + $2,
        updated_at = now()
    where wallet = $1
    returning challenge_tickets
    `,
    [key, Math.max(0, Math.floor(count))]
  );
  return out.rows[0]?.challenge_tickets ?? 0;
}

export async function consumeChallengeTicket(
  wallet: string
): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const currentOut = await dbQuery<{ challenge_tickets: number }>(
    `select challenge_tickets from token_wallets where wallet = $1`,
    [key]
  );
  const current = currentOut.rows[0]?.challenge_tickets ?? 0;
  if (current <= 0) return { ok: false, error: "No challenge tickets left" };
  const nextOut = await dbQuery<{ challenge_tickets: number }>(
    `
    update token_wallets
    set challenge_tickets = challenge_tickets - 1,
        updated_at = now()
    where wallet = $1
    returning challenge_tickets
    `,
    [key]
  );
  return { ok: true, remaining: nextOut.rows[0]?.challenge_tickets ?? 0 };
}

export async function getChallengeTickets(wallet: string): Promise<number> {
  const key = normalizeWallet(wallet);
  await getRoyaleBalance(key);
  const out = await dbQuery<{ challenge_tickets: number }>(
    `select challenge_tickets from token_wallets where wallet = $1`,
    [key]
  );
  return out.rows[0]?.challenge_tickets ?? 0;
}
