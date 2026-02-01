import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";

let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}

const STORE_PATH = path && path.join(process.cwd(), "data", "user-settings.json");

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
  if (!fs || !path || !STORE_PATH) return;
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({}), "utf8");
  }
}

async function readStore(): Promise<Record<string, StoredSettings>> {
  if (!fs || !STORE_PATH) return {};
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
  if (!fs || !STORE_PATH) return;
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
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

  const saved = await saveSettingsToStore(userId, normalized);
  return NextResponse.json({ settings: normalizeSettings(saved) }, { status: 200 });
}
