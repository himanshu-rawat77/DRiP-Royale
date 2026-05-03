import { getHeliusRpcUrl } from "../shared/heliusRpc";
import fs from "node:fs";
import path from "node:path";

type EnvMap = Record<string, string>;

let cachedDotEnv: EnvMap | null = null;

function parseDotEnvFile(): EnvMap {
  if (cachedDotEnv) return cachedDotEnv;
  const out: EnvMap = {};
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      cachedDotEnv = out;
      return out;
    }
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // Ignore parse failures; we'll fall back to process.env/defaults.
  }
  cachedDotEnv = out;
  return out;
}

function pickEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  const dot = parseDotEnvFile();
  for (const key of keys) {
    const v = dot[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

export function getServerHeliusRpcUrl(): string {
  const apiKey = pickEnv("HELIUS_API_KEY", "VITE_HELIUS_API_KEY", "NEXT_PUBLIC_HELIUS_API_KEY");
  const network = pickEnv("SOLANA_NETWORK", "VITE_SOLANA_NETWORK", "NEXT_PUBLIC_SOLANA_NETWORK");
  return getHeliusRpcUrl({ apiKey, network });
}
