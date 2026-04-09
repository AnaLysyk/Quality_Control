"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getAccessToken } from "@/lib/api";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";
export type Language = Locale;

type AppSettings = {
  theme: Theme;
  language: Language;
};

type SaveResult = { ok: boolean; error?: string };

type AppSettingsContextValue = {
  theme: Theme;
  language: Language;
  loading: boolean;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  saveSettings: (next?: Partial<AppSettings>) => Promise<SaveResult>;
  refreshSettings: () => Promise<void>;
};

const DEFAULT_SETTINGS: AppSettings = { theme: "system", language: DEFAULT_LOCALE };

const LAST_USER_ID_KEY = "tc-settings:last-user-id";

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

const isValidTheme = (value?: string | null): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const isValidLanguage = (value?: string | null): value is Language =>
  Boolean(value) && LOCALES.includes(value as Language);

const storageKey = (userId?: string | null) => `tc-settings:${userId ?? "guest"}`;

function resolveUserId(user: { id?: string | null; userId?: string | null } | null | undefined) {
  return (typeof user?.id === "string" && user.id) || (typeof user?.userId === "string" && user.userId) || null;
}

function readLastUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.sessionStorage.getItem(LAST_USER_ID_KEY);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

function rememberLastUserId(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LAST_USER_ID_KEY, userId);
  } catch {
    /* ignore */
  }
}

function readInitialSettings(): AppSettings {
  const lastUserId = readLastUserId();
  const preferredKey = lastUserId ? storageKey(lastUserId) : storageKey(undefined);
  return readStoredSettings(preferredKey) ?? readStoredSettings(storageKey(undefined)) ?? DEFAULT_SETTINGS;
}

function normalizeSettings(input?: Partial<AppSettings> | null): AppSettings {
  const language = isValidLanguage(input?.language) ? (input?.language as Language) : DEFAULT_SETTINGS.language;
  const theme = isValidTheme(input?.theme) ? (input?.theme as Theme) : DEFAULT_SETTINGS.theme;
  return { language, theme };
}

function readStoredSettings(key: string): AppSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

function writeStoredSettings(key: string, settings: AppSettings) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthUser();
  const [settings, setSettings] = useState<AppSettings>(() => readInitialSettings());
  const [loading, setLoading] = useState(true);

  const setTheme = useCallback((theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setLanguage = useCallback((language: Language) => {
    setSettings((prev) => ({ ...prev, language }));
  }, []);

  const refreshSettings = useCallback(async () => {
    const userId = resolveUserId(user);
    const key = storageKey(userId);
    const cached = readStoredSettings(key);
    if (cached) {
      setSettings(cached);
    }

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/user/settings", {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const payload = await res.json().catch(() => null);
      const normalized = normalizeSettings(payload?.settings ?? payload);
      setSettings(normalized);
      writeStoredSettings(key, normalized);
      if (userId) rememberLastUserId(userId);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveSettings = useCallback(
    async (next?: Partial<AppSettings>): Promise<SaveResult> => {
      const userId = resolveUserId(user);
      const key = storageKey(userId);
      const normalized = normalizeSettings({ ...settings, ...next });
      setSettings(normalized);
      writeStoredSettings(key, normalized);

      if (!user) {
        return { ok: true };
      }

      try {
        const token = await getAccessToken().catch(() => null);
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const res = await fetch("/api/user/settings", {
          method: "PATCH",
          headers,
          credentials: "include",
          body: JSON.stringify(normalized),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          return { ok: false, error: payload?.error || "save_failed" };
        }
        const payload = await res.json().catch(() => null);
        const serverSettings = normalizeSettings(payload?.settings ?? payload);
        setSettings(serverSettings);
        writeStoredSettings(key, serverSettings);
        if (userId) rememberLastUserId(userId);
        return { ok: true };
      } catch {
        return { ok: false, error: "save_failed" };
      }
    },
    [settings, user]
  );

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (useDark: boolean) => {
      root.classList.toggle("dark", useDark);
      root.classList.toggle("theme-light", !useDark);
      root.style.colorScheme = useDark ? "dark" : "light";
      root.dataset.themeResolved = useDark ? "dark" : "light";
      root.dataset.themePreference = settings.theme;
    };

    if (settings.theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(media.matches);
      const handleChange = (event: MediaQueryListEvent) => {
        applyTheme(event.matches);
      };
      media.addEventListener("change", handleChange);
      return () => {
        media.removeEventListener("change", handleChange);
      };
    }

    applyTheme(settings.theme === "dark");
    return undefined;
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const value = useMemo(
    () => ({
      theme: settings.theme,
      language: settings.language,
      loading,
      setTheme,
      setLanguage,
      saveSettings,
      refreshSettings,
    }),
    [settings.theme, settings.language, loading, setTheme, setLanguage, saveSettings, refreshSettings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings deve ser usado dentro de AppSettingsProvider");
  return ctx;
}
