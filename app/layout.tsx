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
  return (
    <html lang="pt-BR">
      <body className={`min-h-screen w-full overflow-y-auto ${poppins.variable} ${geistMono.variable} antialiased`}>
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
