// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import AppShell from "@/components/AppShell";
import ToasterProvider from "@/components/ToasterProvider";
import { AuthProvider } from "@/context/AuthContext";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { ClientProvider } from "@/context/ClientContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quality Control",
  description: "Monitoramento inteligente de qualidade em tempo real.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeInitScript = `
    (() => {
      try {
        const root = document.documentElement;
        const isValid = (v) => v === "light" || v === "dark" || v === "system";
        const lastUserId = localStorage.getItem("tc-settings:last-user-id");
        const key = lastUserId ? ("tc-settings:" + lastUserId) : "tc-settings:guest";
        const raw = localStorage.getItem(key) || localStorage.getItem("tc-settings:guest");
        const parsed = raw ? JSON.parse(raw) : null;
        // Standard theme: light by default (avoids dark->light flash on first paint).
        const storedTheme = parsed && isValid(parsed.theme) ? parsed.theme : "light";
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const useDark = storedTheme === "system" ? prefersDark : storedTheme === "dark";
        root.classList.toggle("dark", useDark);
        root.style.colorScheme = useDark ? "dark" : "light";
      } catch (err) {
        /* ignore */
      }
    })();
  `;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen w-full overflow-y-auto antialiased"
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
