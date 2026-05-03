import { Pool, type QueryResultRow } from "pg";

const DATABASE_URL = process.env.DATABASE_URL?.trim() ;
const DATABASE_SSL = process.env.DATABASE_SSL?.trim()?.toLowerCase();

let pool: Pool | null = null;

function isSslEnabled(): boolean {
  if (!DATABASE_SSL) return false;
  return DATABASE_SSL === "true" || DATABASE_SSL === "1" || DATABASE_SSL === "require";
}

function getPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isSslEnabled() ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    });
  }
  return pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const p = getPool();
  return p.query<T>(text, params);
}

export async function ensureDatabaseAvailable(): Promise<void> {
  const p = getPool();
  await p.query("select 1");
}

export function isDatabaseConfigured(): boolean {
  return !!DATABASE_URL;
}
