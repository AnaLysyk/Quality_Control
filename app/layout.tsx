// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist_Mono, Poppins } from "next/font/google";

import AppShell from "@/components/AppShell";
import ToasterProvider from "@/components/ToasterProvider";

import { AuthProvider } from "@/context/AuthContext";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { ClientProvider } from "@/context/ClientContext";

import "./globals.css";

/* =========================
   FONTS
========================= */

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400","500","600","700"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* =========================
   META
========================= */

export const metadata: Metadata = {
  title: "Quality Control",
  description: "Monitoramento inteligente de qualidade em tempo real.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#011848",
};

/* =========================
   THEME BOOTSTRAP
========================= */

const themeInitScript = `
(() => {
  try {
    const root = document.documentElement;

    const isValid = (v) =>
      v === "light" || v === "dark" || v === "system";

    const safeParse = (v) => {
      try { return JSON.parse(v); }
      catch { return null; }
    };

    const lastUserId = localStorage.getItem("tc-settings:last-user-id");
    const key = lastUserId
      ? "tc-settings:" + lastUserId
      : "tc-settings:guest";

    const raw =
      localStorage.getItem(key) ||
      localStorage.getItem("tc-settings:guest");

    const parsed = raw ? safeParse(raw) : null;

    const storedTheme =
      parsed && isValid(parsed.theme)
        ? parsed.theme
        : "light";

    const systemDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const useDark =
      storedTheme === "dark" ||
      (storedTheme === "system" && systemDark);

    root.classList.toggle("dark", useDark);
    root.style.colorScheme = useDark ? "dark" : "light";

  } catch {}
})();
`;

/* =========================
   LAYOUT
========================= */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />

        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>

      <body
        suppressHydrationWarning
        className={`
          min-h-screen
          w-full
          overflow-y-auto
          antialiased
          ${poppins.variable}
          ${geistMono.variable}
        `}
      >
        <AuthProvider>
          <AppSettingsProvider>
            <ClientProvider>

              <AppShell>
                {children}
              </AppShell>

              <ToasterProvider />

            </ClientProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
