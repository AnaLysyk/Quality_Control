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

const STORE_KEY_PREFIX = "qc:user_settings:v1";

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
  const user = await authenticateRequest(req);
  if (!user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const stored = await fetchSettings(user.id);
  const settings = normalizeSettings(stored);
  const response = NextResponse.json({ settings }, { status: 200 });
  applyThemeCookies(response, settings.theme);
  return response;
}

export async function PATCH(req: Request) {
  const user = await authenticateRequest(req);
  if (!user?.id) {
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

  const saved = await saveSettings(user.id, normalized);
  const settings = normalizeSettings(saved);
  const response = NextResponse.json({ settings }, { status: 200 });
  applyThemeCookies(response, settings.theme);
  return response;
}
