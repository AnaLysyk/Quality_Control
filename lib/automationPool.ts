import "server-only";
import pg from "pg";

const { Pool } = pg;

type PoolGlobal = { automationPool?: pg.Pool };
const g = globalThis as unknown as PoolGlobal;

function createPool(): pg.Pool {
  const url =
    process.env.AUTOMATION_POSTGRES_URL ||
    process.env.AUTOMATION_PRISMA_DATABASE_URL ||
    process.env.AUTOMATION_DATABASE_URL;

  if (!url) {
    throw new Error(
      "AUTOMATION_POSTGRES_URL, AUTOMATION_PRISMA_DATABASE_URL or AUTOMATION_DATABASE_URL is required.",
    );
  }

  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function getAutomationPool(): pg.Pool {
  if (!g.automationPool) {
    g.automationPool = createPool();
  }
  return g.automationPool;
}

export const automationPool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, property) {
    const pool = getAutomationPool();
    const value = pool[property as keyof pg.Pool];
    return typeof value === "function" ? value.bind(pool) : value;
  },
});

/**
 * Ensures all automation tables exist. Safe to call on every request (uses IF NOT EXISTS).
 */
export async function ensureAutomationTables(): Promise<void> {
  await getAutomationPool().query(`
    CREATE TABLE IF NOT EXISTS automation_scripts (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      company_slug TEXT NOT NULL,
      path        TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'not_started',
      created_by  TEXT,
      updated_by  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (company_slug, path)
    );
    CREATE INDEX IF NOT EXISTS idx_automation_scripts_company
      ON automation_scripts (company_slug);

    CREATE TABLE IF NOT EXISTS automation_api_requests (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      company_slug TEXT NOT NULL,
      name        TEXT NOT NULL,
      payload     JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_automation_api_requests_company
      ON automation_api_requests (company_slug);

    CREATE TABLE IF NOT EXISTS automation_assets (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      company_slug TEXT NOT NULL,
      name         TEXT NOT NULL,
      kind         TEXT NOT NULL DEFAULT 'other',
      size_bytes   INTEGER NOT NULL DEFAULT 0,
      url          TEXT NOT NULL DEFAULT '',
      uploaded_by  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_automation_assets_company
      ON automation_assets (company_slug);

    CREATE TABLE IF NOT EXISTS automation_asset_regions (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      asset_id     TEXT NOT NULL,
      company_slug TEXT NOT NULL,
      name         TEXT NOT NULL,
      x            REAL NOT NULL DEFAULT 0,
      y            REAL NOT NULL DEFAULT 0,
      w            REAL NOT NULL DEFAULT 0,
      h            REAL NOT NULL DEFAULT 0,
      notes        TEXT,
      color        TEXT NOT NULL DEFAULT '#ef0001',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_automation_asset_regions_asset
      ON automation_asset_regions (asset_id);
    CREATE INDEX IF NOT EXISTS idx_automation_asset_regions_company
      ON automation_asset_regions (company_slug);

    CREATE TABLE IF NOT EXISTS automation_base64_history (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      company_slug    TEXT NOT NULL,
      name            TEXT NOT NULL,
      kind            TEXT NOT NULL DEFAULT 'other',
      size_bytes      INTEGER NOT NULL DEFAULT 0,
      base64_data     TEXT NOT NULL,
      source          TEXT NOT NULL DEFAULT 'upload',
      source_asset_id TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_automation_base64_company
      ON automation_base64_history (company_slug);
  `);
}
