"use client";

import { AppSettingsProvider, useAppSettings, type Theme as ThemeMode } from "@/context/AppSettingsContext";

export type { ThemeMode };
export type ResolvedTheme = "light" | "dark";

export const ThemeProvider = AppSettingsProvider;

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useAppSettings();

  return {
    mode: theme,
    resolvedTheme,
    setMode: setTheme,
  };
}
