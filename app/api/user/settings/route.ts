import { NextResponse } from "next/server";
import {
  APP_SETTINGS_COOKIE_MAX_AGE,
  THEME_PREFERENCE_COOKIE,
  THEME_RESOLVED_COOKIE,
} from "@/lib/appSettingsCookies";
import { authenticateRequest } from "@/lib/jwtAuth";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import { readPersistentJson, writePersistentJson, canUsePersistentJsonStore } from "@/lib/persistentJsonStore";

export const revalidate = 0;

let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}

const DEFAULT_DATA_DIR = path && path.join(process.cwd(), "data");
const DATA_DIR = path && (process.env.USER_SETTINGS_DATA_DIR || DEFAULT_DATA_DIR);
const STORE_PATH = path && DATA_DIR ? path.join(DATA_DIR, "user-settings.json") : undefined;
const STORE_KEY_PREFIX = "qc:user_settings:v1";
const USE_REDIS = process.env.USER_SETTINGS_STORE === "redis" || isRedisConfigured();
const USE_MEMORY = process.env.USER_SETTINGS_IN_MEMORY === "true";
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

function applyThemeCookies(response: NextResponse, theme: Theme) {
  response.cookies.set(THEME_PREFERENCE_COOKIE, theme, {
    path: "/",
    sameSite: "lax",
    maxAge: APP_SETTINGS_COOKIE_MAX_AGE,
  });

  if (theme === "light" || theme === "dark") {
    response.cookies.set(THEME_RESOLVED_COOKIE, theme, {
      path: "/",
      sameSite: "lax",
      maxAge: APP_SETTINGS_COOKIE_MAX_AGE,
    });
  }
}

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

  if (theme === "light" || theme === "dark") {
    response.cookies.set(THEME_RESOLVED_COOKIE, theme, {
      path: "/",
      sameSite: "lax",
      maxAge: APP_SETTINGS_COOKIE_MAX_AGE,
    });
  }
}

function normalizeSettings(input?: Partial<StoredSettings> | null): Omit<StoredSettings, "user_id"> {
  return {
    language: isValidLanguage(input?.language) ? (input?.language as Locale) : DEFAULT_SETTINGS.language,
    theme: isValidTheme(input?.theme) ? (input?.theme as Theme) : DEFAULT_SETTINGS.theme,
  };
}

async function fetchSettings(userId: string): Promise<StoredSettings> {
  const key = `${STORE_KEY_PREFIX}:${userId}`;
  const fallback: StoredSettings = { user_id: userId, ...DEFAULT_SETTINGS };

  if (canUsePersistentJsonStore()) {
    const stored = await readPersistentJson<StoredSettings>(key, fallback);
    return stored ?? fallback;
  }

  return fallback;
}

async function saveSettings(userId: string, next: Omit<StoredSettings, "user_id">): Promise<StoredSettings> {
  const key = `${STORE_KEY_PREFIX}:${userId}`;
  const now = new Date().toISOString();
  const existing = await fetchSettings(userId);
  const saved: StoredSettings = {
    user_id: userId,
    language: next.language,
    theme: next.theme,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writePersistentJson(key, saved);
  return saved;
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const stored = await fetchSettingsFromStore(userId);
  const settings = normalizeSettings(stored);
  const response = NextResponse.json({ settings }, { status: 200 });
  applyThemeCookies(response, settings.theme);
  return response;
}

export async function PATCH(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

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
  const settings = normalizeSettings(saved);
  const response = NextResponse.json({ settings }, { status: 200 });
  applyThemeCookies(response, settings.theme);
  return response;
}
