import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import { getRedis, isRedisConfigured } from "@/lib/redis";

let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}

const DEFAULT_DATA_DIR = path && path.join(process.cwd(), "data");
const DATA_DIR =
  path &&
  (process.env.USER_SETTINGS_DATA_DIR ||
    (process.env.VERCEL === "1" ? path.join("/tmp", "qc-data") : DEFAULT_DATA_DIR));
const STORE_PATH = path && DATA_DIR ? path.join(DATA_DIR, "user-settings.json") : undefined;
const STORE_KEY_PREFIX = "qc:user_settings:v1";
const USE_REDIS = process.env.USER_SETTINGS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY =
  process.env.USER_SETTINGS_IN_MEMORY === "true" ||
  (!USE_REDIS && process.env.VERCEL === "1");
let memoryStore: Record<string, StoredSettings> = {};
let warnedFsFailure = false;

type Theme = "light" | "dark" | "system";

type StoredSettings = {
  user_id: string;
  language: Locale;
  theme: Theme;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_SETTINGS: Omit<StoredSettings, "user_id"> = {
  language: DEFAULT_LOCALE,
  theme: "system",
};

const isValidTheme = (value?: string | null): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const isValidLanguage = (value?: string | null): value is Locale =>
  Boolean(value) && LOCALES.includes(value as Locale);

async function readStoreFile(): Promise<Record<string, StoredSettings>> {
  if (!fs || !STORE_PATH) return {};
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredSettings>) : {};
  } catch {
    return {};
  }
}

async function writeStoreFile(data: Record<string, StoredSettings>) {
  if (!fs || !path || !STORE_PATH) return;
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    if (!warnedFsFailure) {
      warnedFsFailure = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[userSettings] Falha ao escrever arquivo, usando memoria:", msg);
    }
    memoryStore = data;
  }
}

async function readSettingsFromRedis(userId: string): Promise<StoredSettings | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(`${STORE_KEY_PREFIX}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSettings;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[userSettings] Redis read failed, falling back:", msg);
    return null;
  }
}

async function writeSettingsToRedis(userId: string, settings: StoredSettings): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.set(`${STORE_KEY_PREFIX}:${userId}`, JSON.stringify(settings));
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[userSettings] Redis write failed, falling back:", msg);
    return false;
  }
}

function normalizeSettings(input?: Partial<StoredSettings> | null): Omit<StoredSettings, "user_id"> {
  return {
    language: isValidLanguage(input?.language) ? (input?.language as Locale) : DEFAULT_SETTINGS.language,
    theme: isValidTheme(input?.theme) ? (input?.theme as Theme) : DEFAULT_SETTINGS.theme,
  };
}

async function resolveUserId(req: Request): Promise<string | null> {
  const user = await authenticateRequest(req);
  return user?.id ?? null;
}

async function fetchSettingsFromStore(userId: string): Promise<StoredSettings> {
  if (USE_REDIS) {
    const fromRedis = await readSettingsFromRedis(userId);
    if (fromRedis) return fromRedis;
  }

  if (USE_MEMORY) {
    return memoryStore[userId] ?? { user_id: userId, ...DEFAULT_SETTINGS };
  }

  const store = await readStoreFile();
  const entry = store[userId] ?? { user_id: userId, ...DEFAULT_SETTINGS };
  if (USE_REDIS) {
    await writeSettingsToRedis(userId, entry);
  }
  return entry;
}

async function saveSettingsToStore(userId: string, next: Omit<StoredSettings, "user_id">) {
  const now = new Date().toISOString();
  const existing =
    (USE_REDIS ? await readSettingsFromRedis(userId) : null) ??
    memoryStore[userId] ??
    (USE_MEMORY ? null : (await readStoreFile())[userId]);
  const saved: StoredSettings = {
    user_id: userId,
    language: next.language,
    theme: next.theme,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  if (USE_REDIS) {
    const ok = await writeSettingsToRedis(userId, saved);
    if (ok) return saved;
  }

  if (USE_MEMORY) {
    memoryStore[userId] = saved;
    return saved;
  }

  const store = await readStoreFile();
  store[userId] = saved;
  await writeStoreFile(store);
  return saved;
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  // Audit log
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  console.info("[USER_SETTINGS_GET]", {
    userId,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  const stored = await fetchSettingsFromStore(userId);
  return NextResponse.json({ settings: normalizeSettings(stored) }, { status: 200 });
}

export async function PATCH(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  // Audit log
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  console.info("[USER_SETTINGS_PATCH]", {
    userId,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  const body = await req.json().catch(() => ({}));
  const rawTheme = body?.theme ? String(body.theme) : null;
  const rawLanguage = body?.language ? String(body.language) : null;

  if (rawTheme && !isValidTheme(rawTheme)) {
    return NextResponse.json({ error: "Tema invalido" }, { status: 400 });
  }
  if (rawLanguage && !isValidLanguage(rawLanguage)) {
    return NextResponse.json({ error: "Idioma invalido" }, { status: 400 });
  }

  const normalized = normalizeSettings({
    language: rawLanguage as Locale | undefined,
    theme: rawTheme as Theme | undefined,
  });

  const saved = await saveSettingsToStore(userId, normalized);
  return NextResponse.json({ settings: normalizeSettings(saved) }, { status: 200 });
}
