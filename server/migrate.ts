/**
 * Runs at startup before the HTTP server.
 * Creates the mod_requests table if it doesn't exist — no drizzle-kit needed.
 */
import pg from "pg";
import { logger } from "./lib/logger";

const { Pool } = pg;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mod_requests (
  id          SERIAL PRIMARY KEY,
  mc_version  VARCHAR(32)  NOT NULL,
  mod_loader  VARCHAR(32)  NOT NULL,
  prompt      TEXT         NOT NULL,
  title       TEXT         NOT NULL,
  status      VARCHAR(16)  NOT NULL,
  summary     TEXT         NOT NULL DEFAULT '',
  result_markdown TEXT     NOT NULL DEFAULT '',
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
`;

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(CREATE_TABLE_SQL);
    logger.info("Database migration completed (mod_requests table ready)");
  } finally {
    await pool.end();
  }
}
