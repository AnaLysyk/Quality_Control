"use client";

import Link from "next/link";
import styles from "./LoginClient.module.css";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginClient() {
  const router = useRouter();
  const { refreshUser } = useAuthUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        await refreshUser();
        router.push("/dashboard");
      } else {
        const data = await res.json().catch(() => null);
        setError((data?.error as string) || "Erro ao autenticar");
      }
    } catch (err) {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginContainer + " min-h-svh flex items-start sm:items-center justify-start sm:justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] relative overflow-x-hidden overflow-y-auto px-4 py-10 sm:px-6 md:px-10"}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        <div className="absolute top-10 left-44 w-16 h-16 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#011848] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[#011848] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="max-w-lg w-full space-y-8 relative z-10 sm:max-w-xl md:max-w-2xl">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-linear-to-r from-[#011848] to-[#ef0001] rounded-full flex items-center justify-center mb-6 shadow-lg">
            <img src="/images/tc.png" alt="Logo Quality Control" className="w-12 h-12 sm:w-16 sm:h-16 animate-spin-slower select-none pointer-events-none" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#011848] mb-2 leading-tight">Quality Control</h2>
          <p className="text-[#4b5563]">Bem-vindo, entre na sua conta</p>
        </div>

        <form
          className="bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-[#011848]/10 w-full max-w-md sm:max-w-lg mx-auto min-w-0"
          onSubmit={handleSubmit}
        >
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
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 border border-[#011848]/20 rounded-lg focus:ring-2 focus:ring-[#ef0001] focus:border-transparent transition-all duration-200 bg-white/80 pr-11"
                  placeholder="•••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-[#64748b] hover:text-[#011848]"
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
                </button>
              </div>
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Entrando...
              </div>
            ) : (
              "Entrar"
            )}
          </button>

          <div className="mt-6 text-sm text-[#4b5563]">
            <div className="flex flex-col items-center gap-2">
              <Link href="/login/forgot-password" className="font-semibold text-[#011848]/90 hover:text-[#011848]">
                Esqueci minha senha
              </Link>
              <div className="flex w-full items-center gap-3 text-xs uppercase tracking-[0.4em] text-[#c1c5d1]">
                <span className="flex-1 h-px bg-linear-to-r from-[#E5E7EB]/0 via-[#E5E7EB] to-[#E5E7EB]/0" />
                <span className="px-1 text-[10px] tracking-[0.35em] text-[#c1c5d1]">OU</span>
                <span className="flex-1 h-px bg-linear-to-r from-[#E5E7EB]/0 via-[#E5E7EB] to-[#E5E7EB]/0" />
              </div>
              <Link href="/login/access-request" className="font-semibold text-[#ef0001] hover:text-[#c70000]">
                Solicitar acesso
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
