import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbQuery, ensureDatabaseAvailable, isDatabaseConfigured } from "../db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required to initialize database");
  }
  await ensureDatabaseAvailable();

  const schemaPath = path.resolve(__dirname, "..", "db-schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf-8");
  await dbQuery(schemaSql);
  console.log("Database schema initialized.");
}

main().catch((err) => {
  console.error("Database init failed:", err);
  process.exit(1);
});
