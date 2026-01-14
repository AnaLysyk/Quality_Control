"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

function normalizeBaseUrl(value: string | undefined | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let url = raw.replace(/\s+/g, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return null;
    const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? window.location.origin;
    return `${baseUrl}/login/reset-password`;
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Informe seu e-mail");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: redirectTo ?? undefined,
      });

      if (resetError) {
        setError("Não foi possível enviar o e-mail de recuperação.");
        return;
      }

      // Mensagem neutra para evitar enumeração de usuários.
      setSuccess("Se esse e-mail existir, enviamos um link para redefinir sua senha.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível enviar o e-mail de recuperação.";
      if (message === "Failed to fetch" || /failed to fetch/i.test(message)) {
        setError(
          "Não foi possível conectar ao Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY e sua conectividade."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#041a49] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-[#0b1a3c]">Recuperar senha</h1>
          <p className="mt-1 text-sm text-gray-600">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>

          <form className="mt-4 space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            {success && <div className="text-sm text-green-700">{success}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-linear-to-r from-[#e53935] to-[#d81b60] py-2 text-white font-semibold shadow-md hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            <div className="text-center text-sm">
              <Link href="/login" className="text-blue-700 hover:underline">
                Voltar ao login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
