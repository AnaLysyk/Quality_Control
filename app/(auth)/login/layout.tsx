// ESTE ARQUIVO NÃO PODE TER "use client"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - Painel QA",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="griaule-wall relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
