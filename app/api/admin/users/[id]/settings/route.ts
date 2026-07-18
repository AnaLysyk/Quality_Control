import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/backend/auth/session";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/backend/i18n";
import { readPersistentJson, writePersistentJson } from "@/database/persistentJsonStore";
import { validarAcessoUsuariosNoServidor } from "@/backend/permissions/validarAcessoUsuariosNoServidor";

export const revalidate = 0;

type Theme = "light" | "dark" | "system";

type StoredSettings = {
  user_id: string;
  language: Locale;
  theme: Theme;
  created_at?: string;
  updated_at?: string;
};
type UserAccessFlag = "canViewUsers" | "canEditUsers";

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

async function requireUserAccess(req: NextRequest, flag: UserAccessFlag, forbiddenMessage: string) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userAccess = await validarAcessoUsuariosNoServidor(access);
  if (!userAccess[flag]) {
    return NextResponse.json({ error: forbiddenMessage }, { status: 403 });
  }

  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireUserAccess(_req, "canViewUsers", "Sem permissão para visualizar usuários");
  if (forbidden) return forbidden;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do usuário inválido" }, { status: 400 });
  }

  const stored = await fetchSettings(id);
  return NextResponse.json({ settings: normalizeSettings(stored) }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireUserAccess(req, "canEditUsers", "Sem permissão para editar usuários");
  if (forbidden) return forbidden;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do usuário inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rawTheme = body?.theme ? String(body.theme) : null;
  const rawLanguage = body?.language ? String(body.language) : null;

  if (rawTheme && !isValidTheme(rawTheme)) {
    return NextResponse.json({ error: "Tema inválido" }, { status: 400 });
  }
  if (rawLanguage && !isValidLanguage(rawLanguage)) {
    return NextResponse.json({ error: "Idioma inválido" }, { status: 400 });
  }

  const normalized = normalizeSettings({
    language: rawLanguage as Locale | undefined,
    theme: rawTheme as Theme | undefined,
  });

  const saved = await saveSettings(id, normalized);
  return NextResponse.json({ settings: normalizeSettings(saved) }, { status: 200 });
}
