"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function LoginClient() {
  const router = useRouter();
  const { refreshUser } = useAuthUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        await refreshUser();
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] relative overflow-hidden">
      {/* Animated background elements com as cores da marca */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Canto superior esquerdo */}
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        {/* Canto inferior direito */}
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        {/* Meio superior direito */}
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        {/* Meio inferior esquerdo */}
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        {/* Topo lateral direita (reposicionada para o lado da azul) */}
        <div className="absolute top-10 left-44 w-16 h-16 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        {/* Base central */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#011848] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        {/* Meio lateral esquerda */}
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        {/* Meio lateral direita */}
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[#011848] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center">
          <div className="mx-auto w-24 h-24 bg-linear-to-r from-[#011848] to-[#ef0001] rounded-full flex items-center justify-center mb-6 shadow-lg">
            <img src="/images/tc.png" alt="Logo Testing Company" className="w-16 h-16 animate-spin-slower select-none pointer-events-none" />
          </div>
          <h2 className="text-4xl font-bold text-[#011848] mb-2">
            Bem-vindo
          </h2>
          <p className="text-[#4b5563]">
            Entre na sua conta
          </p>
        </div>
        
        <form className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-[#011848]/10" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#011848] mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3 border border-[#011848]/20 rounded-lg focus:ring-2 focus:ring-[#ef0001] focus:border-transparent transition-all duration-200 bg-white/80"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#011848] mb-1">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 border border-[#011848]/20 rounded-lg focus:ring-2 focus:ring-[#ef0001] focus:border-transparent transition-all duration-200 bg-white/80"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-linear-to-r from-[#011848] to-[#ef0001] text-white py-3 px-4 rounded-lg font-medium hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:ring-2 focus:ring-[#ef0001] focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Entrando...
              </div>
            ) : (
              "Entrar"
            )}
          </button>
          <div className="mt-4 flex items-center justify-between text-sm text-[#4b5563]">
            <Link
              href="/login/forgot-password"
              className="font-medium text-[#011848]/90 hover:text-[#011848]"
            >
              Esqueci minha senha
            </Link>
            <Link
              href="/login/access-request"
              className="font-medium text-[#ef0001]/90 hover:text-[#ef0001]"
            >
              Solicitar acesso
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
