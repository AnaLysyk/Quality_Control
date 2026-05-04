export const THEME_PREFERENCE_COOKIE = "qc_theme_preference";
export const THEME_RESOLVED_COOKIE = "qc_theme_resolved";
export const APP_SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function normalizeThemePreference(value?: string | null): ThemePreference | null {
  if (value === "light" || value === "dark" || value === "system") return value;
  return null;
}

export function normalizeResolvedTheme(value?: string | null): ResolvedTheme | null {
  if (value === "light" || value === "dark") return value;
  return null;
}
