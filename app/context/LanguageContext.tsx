"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { type Locale, type Translations, translations } from "@/i18n/translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  toggleLocale: () => void;
}

const fallbackLanguageContext: LanguageContextType = {
  locale: "pt",
  setLocale: () => undefined,
  t: translations.pt,
  toggleLocale: () => undefined,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "painel-qa-locale";
const SETTINGS_BOOTSTRAP_KEY = "tc-settings:bootstrap";

function isLocale(value: unknown): value is Locale {
  return value === "pt" || value === "en";
}

function languageToLocale(value: unknown): Locale | null {
  if (value === "pt-BR") return "pt";
  if (value === "en-US") return "en";
  return null;
}

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "pt";

  try {
    const direct = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(direct)) return direct;
  } catch {
    // localStorage not available
  }

  try {
    const bootstrap = window.sessionStorage.getItem(SETTINGS_BOOTSTRAP_KEY);
    if (bootstrap) {
      const parsed = JSON.parse(bootstrap) as { language?: unknown };
      const mapped = languageToLocale(parsed.language);
      if (mapped) return mapped;
    }
  } catch {
    // sessionStorage not available
  }

  return "pt";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // localStorage not available
    }

    if (typeof document !== "undefined") {
      document.documentElement.dataset.locale = newLocale;
      document.documentElement.lang = newLocale === "en" ? "en-US" : "pt-BR";
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tc:locale-change", { detail: { locale: newLocale } }));
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "pt" ? "en" : "pt");
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.dataset.locale = locale;
    document.documentElement.lang = locale === "en" ? "en-US" : "pt-BR";
  }, [locale]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !isLocale(event.newValue)) return;
      setLocaleState(event.newValue);
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const t = useMemo(() => translations[locale], [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, toggleLocale }),
    [locale, setLocale, t, toggleLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext) ?? fallbackLanguageContext;
}

export function useTranslation() {
  const { t, locale } = useLanguage();
  return { t, locale };
}
