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

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

const isValidTheme = (value?: string | null): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const isValidLanguage = (value?: string | null): value is Language =>
  Boolean(value) && LOCALES.includes(value as Language);

const storageKey = (userId?: string | null) => `tc-settings:${userId ?? "guest"}`;

function normalizeSettings(input?: Partial<AppSettings> | null): AppSettings {
  const language = isValidLanguage(input?.language) ? (input?.language as Language) : DEFAULT_SETTINGS.language;
  const theme = isValidTheme(input?.theme) ? (input?.theme as Theme) : DEFAULT_SETTINGS.theme;
  return { language, theme };
}

function readStoredSettings(key: string): AppSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
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
    window.localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthUser();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    const key = storageKey(user?.id);
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user?.id, user]);

  const saveSettings = useCallback(
    async (next?: Partial<AppSettings>): Promise<SaveResult> => {
      const key = storageKey(user?.id);
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
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applySystemTheme = () => {
      root.classList.toggle("dark", media.matches);
    };

    if (settings.theme === "system") {
      applySystemTheme();
      if (media.addEventListener) {
        media.addEventListener("change", applySystemTheme);
        return () => media.removeEventListener("change", applySystemTheme);
      }
      media.addListener(applySystemTheme);
      return () => media.removeListener(applySystemTheme);
    }

    root.classList.toggle("dark", settings.theme === "dark");
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
      setTheme: (theme: Theme) => setSettings((prev) => ({ ...prev, theme })),
      setLanguage: (language: Language) => setSettings((prev) => ({ ...prev, language })),
      saveSettings,
      refreshSettings,
    }),
    [settings.theme, settings.language, loading, saveSettings, refreshSettings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings deve ser usado dentro de AppSettingsProvider");
  return ctx;
}
