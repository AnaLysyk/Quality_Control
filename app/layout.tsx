// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Geist_Mono, Poppins } from "next/font/google";
import AppShell from "@/components/AppShell";
import ToasterProvider from "@/components/ToasterProvider";
import { AuthProvider } from "@/context/AuthContext";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { ClientProvider } from "@/context/ClientContext";
import {
  THEME_PREFERENCE_COOKIE,
  THEME_RESOLVED_COOKIE,
  normalizeResolvedTheme,
  normalizeThemePreference,
} from "@/lib/appSettingsCookies";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quality Control",
  description: "Monitoramento inteligente de qualidade em tempo real.",
};
// Add default icons so browsers show the app logo in the tab
metadata.icons = {
  icon: [
    { url: "/images/tc.png", type: "image/png" }
  ],
  apple: [
    { url: "/images/tc.png" }
  ]
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialThemePreference =
    normalizeThemePreference(cookieStore.get(THEME_PREFERENCE_COOKIE)?.value) ?? "system";
  const cookieResolvedTheme = normalizeResolvedTheme(cookieStore.get(THEME_RESOLVED_COOKIE)?.value);
  const initialResolvedTheme =
    initialThemePreference === "dark"
      ? "dark"
      : initialThemePreference === "light"
        ? "light"
        : cookieResolvedTheme ?? "light";
  const initialUseDark = initialResolvedTheme === "dark";
  const themeInitScript = `
    (() => {
      try {
        const root = document.documentElement;
        const isValid = (v) => v === "light" || v === "dark" || v === "system";
        const isResolved = (v) => v === "light" || v === "dark";
        const readCookie = (name) => {
          const prefix = name + "=";
          const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
          return match ? decodeURIComponent(match.slice(prefix.length)) : null;
        };
        const bootstrapKey = "tc-settings:bootstrap";
        const lastUserId = sessionStorage.getItem("tc-settings:last-user-id");
        const key = lastUserId ? ("tc-settings:" + lastUserId) : "tc-settings:guest";
        const raw = sessionStorage.getItem(bootstrapKey) || sessionStorage.getItem(key) || sessionStorage.getItem("tc-settings:guest");
        const parsed = raw ? JSON.parse(raw) : null;
        const cookieTheme = readCookie("${THEME_PREFERENCE_COOKIE}");
        const cookieResolved = readCookie("${THEME_RESOLVED_COOKIE}");
        const storedTheme = parsed && isValid(parsed.theme) ? parsed.theme : (isValid(cookieTheme) ? cookieTheme : "system");
        const storedLanguage = parsed && (parsed.language === "pt-BR" || parsed.language === "en-US") ? parsed.language : "pt-BR";
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const useDark = storedTheme === "dark" || (storedTheme === "system" && (isResolved(cookieResolved) ? cookieResolved === "dark" : prefersDark));
        const resolvedTheme = useDark ? "dark" : "light";
        root.classList.toggle("dark", useDark);
        root.classList.toggle("theme-light", !useDark);
        root.dataset.theme = resolvedTheme;
        root.dataset.themePreference = storedTheme;
        root.dataset.themeResolved = resolvedTheme;
        root.lang = storedLanguage;
      } catch (err) {
        /* ignore */
      }
    })();
  `;

  const migrateStorageScript = `
    (() => {
      try {
        // Migrate legacy keys from localStorage to sessionStorage for session-scoped data
        if (!window.sessionStorage || !window.localStorage) return;
        const prefixes = ["tc-settings:", "activeClient:", "assistant_history", "qcnotes", "tcnotes", "qcnotes_widget", "qcnotes_widget_state"];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          const shouldMigrate = prefixes.some(p => key.indexOf(p) === 0);
          if (!shouldMigrate) continue;
          // If sessionStorage already has a value, prefer it; otherwise copy from localStorage
          if (!sessionStorage.getItem(key)) {
            const v = localStorage.getItem(key);
            if (v !== null) sessionStorage.setItem(key, v);
          }
          // remove legacy localStorage entry
          localStorage.removeItem(key);
        }
      } catch (e) {
        // best-effort migration; ignore errors
      }
    })();
  `;

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={initialUseDark ? "dark" : "theme-light"}
      data-theme={initialResolvedTheme}
      data-theme-preference={initialThemePreference}
      data-theme-resolved={initialResolvedTheme}
    >
      <head>
        <Script id="migrate-storage" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: migrateStorageScript }} />
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className={`min-h-screen w-full overflow-y-auto ${poppins.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <AppSettingsProvider>
            <ClientProvider>
              <AppShell>
                {children}
                <ToasterProvider />
              </AppShell>
            </ClientProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
