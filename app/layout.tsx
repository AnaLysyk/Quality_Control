// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { ClientProvider } from "@/context/ClientContext";
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
  title: "Testing Metric",
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
        const raw = localStorage.getItem("tc-settings:guest");
        const parsed = raw ? JSON.parse(raw) : null;
        const storedTheme = parsed && isValid(parsed.theme) ? parsed.theme : "system";
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const useDark = storedTheme === "system" ? prefersDark : storedTheme === "dark";
        root.classList.toggle("dark", useDark);
      } catch (err) {
        /* ignore */
      }
    })();
  `;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`min-h-screen w-full overflow-y-auto ${poppins.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AuthProvider>
          <AppSettingsProvider>
            <ClientProvider>
              <AppShell>{children}</AppShell>
            </ClientProvider>
          </AppSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
