import { NextRequest, NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import { readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";

export const revalidate = 0;

type Theme = "light" | "dark" | "system";

type StoredSettings = {
  user_id: string;
  language: Locale;
  theme: Theme;
  created_at?: string;
  updated_at?: string;
};

const STORE_KEY_PREFIX = "qc:user_settings:v1";

const DEFAULT_SETTINGS: Omit<StoredSettings, "user_id"> = {
  language: DEFAULT_LOCALE,
  theme: "system",
};

const isValidTheme = (value?: string | null): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const isValidLanguage = (value?: string | null): value is Locale =>
  Boolean(value) && LOCALES.includes(value as Locale);

function normalizeSettings(input?: Partial<StoredSettings> | null): Omit<StoredSettings, "user_id"> {
  return {
    language: isValidLanguage(input?.language) ? (input?.language as Locale) : DEFAULT_SETTINGS.language,
    theme: isValidTheme(input?.theme) ? (input?.theme as Theme) : DEFAULT_SETTINGS.theme,
  };
}

async function fetchSettings(userId: string): Promise<StoredSettings> {
  const key = `${STORE_KEY_PREFIX}:${userId}`;
  const fallback: StoredSettings = { user_id: userId, ...DEFAULT_SETTINGS };
  const stored = await readPersistentJson<StoredSettings>(key, fallback);
  return stored ?? fallback;
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(_req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "NÃ£o autenticado" : "Sem permissÃ£o" }, { status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do usuÃ¡rio invÃ¡lido" }, { status: 400 });
  }

  const stored = await fetchSettings(id);
  return NextResponse.json({ settings: normalizeSettings(stored) }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "NÃ£o autenticado" : "Sem permissÃ£o" }, { status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do usuÃ¡rio invÃ¡lido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rawTheme = body?.theme ? String(body.theme) : null;
  const rawLanguage = body?.language ? String(body.language) : null;

  if (rawTheme && !isValidTheme(rawTheme)) {
    return NextResponse.json({ error: "Tema invÃ¡lido" }, { status: 400 });
  }
  if (rawLanguage && !isValidLanguage(rawLanguage)) {
    return NextResponse.json({ error: "Idioma invÃ¡lido" }, { status: 400 });
  }

  const normalized = normalizeSettings({
    language: rawLanguage as Locale | undefined,
    theme: rawTheme as Theme | undefined,
  });

  const saved = await saveSettings(id, normalized);
  return NextResponse.json({ settings: normalizeSettings(saved) }, { status: 200 });
}

