import "server-only";
import pg from "pg";
import { resolveDatabaseUrlFromEnv } from "@/lib/databaseUrl";

const { Pool } = pg;

type PoolGlobal = { automationPool?: pg.Pool };
const g = globalThis as unknown as PoolGlobal;

let automationTablesReady = false;
let automationTablesInitPromise: Promise<void> | null = null;

function createPool(): pg.Pool {
  const url = resolveDatabaseUrlFromEnv("automation");

  if (!url) {
    throw new Error(
      "AUTOMATION_DATABASE_URL, AUTOMATION_PRISMA_DATABASE_URL, PRISMA_DATABASE_URL, AUTOMATION_POSTGRES_PRISMA_URL, AUTOMATION_POSTGRES_URL, POSTGRES_PRISMA_URL, POSTGRES_URL or DATABASE_URL is required.",
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
  if (automationTablesReady) return;
  if (automationTablesInitPromise) {
    await automationTablesInitPromise;
    return;
  }

  automationTablesInitPromise = (async () => {
    const pool = getAutomationPool();
    const client = await pool.connect();
    try {
      // Serializa o bootstrap entre processos/nÃ³s para evitar corrida de CREATE TABLE.
      await client.query("SELECT pg_advisory_lock($1)", [8_274_221]);

      await client.query(`
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

        CREATE TABLE IF NOT EXISTS playwright_runs (
          id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          company_slug TEXT NOT NULL,
          project_id   TEXT,
          title        TEXT NOT NULL DEFAULT '',
          browser      TEXT NOT NULL DEFAULT 'chromium',
          base_url     TEXT NOT NULL DEFAULT '',
          headless     BOOLEAN NOT NULL DEFAULT TRUE,
          timeout_ms   INTEGER NOT NULL DEFAULT 30000,
          workers      INTEGER NOT NULL DEFAULT 2,
          retries      INTEGER NOT NULL DEFAULT 0,
          screenshot_on TEXT NOT NULL DEFAULT 'only-on-failure',
          video_on     TEXT NOT NULL DEFAULT 'retain-on-failure',
          trace_on     TEXT NOT NULL DEFAULT 'off',
          status       TEXT NOT NULL DEFAULT 'queued',
          run_mode     TEXT NOT NULL DEFAULT 'all',
          selected_specs JSONB NOT NULL DEFAULT '[]',
          source_run_id TEXT,
          started_at   TIMESTAMPTZ,
          finished_at  TIMESTAMPTZ,
          exit_code    INTEGER,
          created_by   TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_playwright_runs_company
          ON playwright_runs (company_slug);
        CREATE INDEX IF NOT EXISTS idx_playwright_runs_status
          ON playwright_runs (status);

        CREATE TABLE IF NOT EXISTS playwright_run_results (
          id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          run_id       TEXT NOT NULL,
          spec_file    TEXT NOT NULL DEFAULT '',
          title        TEXT NOT NULL DEFAULT '',
          status       TEXT NOT NULL DEFAULT 'running',
          duration_ms  INTEGER NOT NULL DEFAULT 0,
          error_msg    TEXT,
          stdout       TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_playwright_run_results_run
          ON playwright_run_results (run_id);

        CREATE TABLE IF NOT EXISTS playwright_spec_snapshots (
          id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          company_slug  TEXT NOT NULL,
          spec_path     TEXT NOT NULL,
          content_hash  TEXT NOT NULL,
          last_run_id   TEXT,
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (company_slug, spec_path)
        );
        CREATE INDEX IF NOT EXISTS idx_playwright_spec_snapshots_company
          ON playwright_spec_snapshots (company_slug);

        CREATE TABLE IF NOT EXISTS playwright_agent_tasks (
          id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          company_slug TEXT NOT NULL,
          agent_type   TEXT NOT NULL,
          status       TEXT NOT NULL DEFAULT 'pending',
          input_json   JSONB NOT NULL DEFAULT '{}',
          output_json  JSONB,
          error        TEXT,
          created_by   TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          finished_at  TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_playwright_agent_tasks_company
          ON playwright_agent_tasks (company_slug);

        ALTER TABLE playwright_runs ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'all';
        ALTER TABLE playwright_runs ADD COLUMN IF NOT EXISTS selected_specs JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE playwright_runs ADD COLUMN IF NOT EXISTS source_run_id TEXT;
        ALTER TABLE playwright_runs ADD COLUMN IF NOT EXISTS project_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_playwright_runs_company_project_created
          ON playwright_runs(company_slug, project_id, created_at DESC);
      `);

      automationTablesReady = true;
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [8_274_221]);
      } catch {
        // ignore unlock error
      }
      client.release();
    }
  })();

  try {
    await automationTablesInitPromise;
  } finally {
    automationTablesInitPromise = null;
  }
}

