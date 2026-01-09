import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";
const STORE_PATH = path.join(process.cwd(), "data", "user-settings.json");

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

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({}), "utf8");
  }
}

async function readStore(): Promise<Record<string, StoredSettings>> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredSettings>) : {};
  } catch {
    return {};
  }
}

async function writeStore(data: Record<string, StoredSettings>) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function normalizeSettings(input?: Partial<StoredSettings> | null): Omit<StoredSettings, "user_id"> {
  return {
    language: isValidLanguage(input?.language) ? (input?.language as Locale) : DEFAULT_SETTINGS.language,
    theme: isValidTheme(input?.theme) ? (input?.theme as Theme) : DEFAULT_SETTINGS.theme,
  };
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7);
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

async function resolveUserId(req: Request): Promise<string | null> {
  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const isAdmin = roleCookie === "admin";
    return isAdmin ? "mock-admin" : "mock-user";
  }

  const token = extractToken(req);
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  return userRow?.id ?? null;
}

async function fetchSettingsFromStore(userId: string): Promise<StoredSettings> {
  const store = await readStore();
  const entry = store[userId];
  if (entry) return entry;
  return { user_id: userId, ...DEFAULT_SETTINGS };
}

async function saveSettingsToStore(userId: string, next: Omit<StoredSettings, "user_id">) {
  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store[userId];
  store[userId] = {
    user_id: userId,
    language: next.language,
    theme: next.theme,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await writeStore(store);
  return store[userId];
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  if (!SUPABASE_MOCK) {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from("user_settings")
        .select("language, theme")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!error) {
        const normalized = normalizeSettings(data ?? null);
        return NextResponse.json({ settings: normalized }, { status: 200 });
      }
    } catch {
      /* fallback to file store */
    }
  }

  const stored = await fetchSettingsFromStore(userId);
  return NextResponse.json({ settings: normalizeSettings(stored) }, { status: 200 });
}

export async function PATCH(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
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

  if (!SUPABASE_MOCK) {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin
        .from("user_settings")
        .upsert(
          {
            user_id: userId,
            language: normalized.language,
            theme: normalized.theme,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (!error) {
        return NextResponse.json({ settings: normalized }, { status: 200 });
      }
    } catch {
      /* fallback to file store */
    }
  }

  const saved = await saveSettingsToStore(userId, normalized);
  return NextResponse.json({ settings: normalizeSettings(saved) }, { status: 200 });
}
