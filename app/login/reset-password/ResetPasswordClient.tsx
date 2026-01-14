"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function parseHashTokens() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

function parseQueryTokens(search: URLSearchParams) {
  const access_token = search.get("access_token");
  const refresh_token = search.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export default function ResetPasswordClient() {
  const router = useRouter();
  const search = useSearchParams();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const recoveryToken = useMemo(() => {
    const token = search.get("token");
    const type = search.get("type");
    if (!token || !type) return null;
    if (type !== "recovery") return null;
    return token;
  }, [search]);

  const code = useMemo(() => {
    const c = search.get("code");
    return typeof c === "string" && c.trim().length ? c.trim() : null;
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        // 1) PKCE flow: ?code=...
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError("Link inválido ou expirado. Solicite um novo reset de senha.");
            setLoading(false);
            return;
          }
          // Limpa o code da URL (evita ficar salvo no histórico)
          router.replace("/login/reset-password");
        }

        // 2) Tokens na querystring (muito comum no redirect do /auth/v1/verify)
        const queryTokens = parseQueryTokens(new URLSearchParams(window.location.search));
        if (queryTokens) {
          const { error: setErrorSession } = await supabase.auth.setSession(queryTokens);
          if (setErrorSession) {
            setError("Link inválido ou expirado. Solicite um novo reset de senha.");
            setLoading(false);
            return;
          }
          router.replace("/login/reset-password");
        }

        // 3) Implicit flow (hash tokens): #access_token=...&refresh_token=...
        const tokens = parseHashTokens();
        if (tokens) {
          const { error: setErrorSession } = await supabase.auth.setSession(tokens);
          if (setErrorSession) {
            setError("Link inválido ou expirado. Solicite um novo reset de senha.");
            setLoading(false);
            return;
          }
          router.replace("/login/reset-password");
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) {
          // Fallback: alguns templates legados enviam apenas ?type=recovery&token=...
          if (recoveryToken) {
            setReady(true);
            setLoading(false);
            return;
          }

          setError("Abra este link a partir do e-mail de recuperação.");
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Não foi possível validar o link.";
        const friendly =
          msg === "Failed to fetch" || /failed to fetch/i.test(msg)
            ? "Não foi possível conectar ao Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY e sua conectividade."
            : msg;
        if (!cancelled) {
          setError(friendly);
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [code, recoveryToken, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();

    if (!p1 || !p2) {
      setError("Informe a nova senha e a confirmação");
      return;
    }
    if (p1.length < MIN_PASSWORD_LENGTH || p1.length > MAX_PASSWORD_LENGTH) {
      setError("A senha deve ter entre 8 e 128 caracteres");
      return;
    }
    if (p1 !== p2) {
      setError("As senhas não conferem");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();

      // Se não houver sessão, tentamos o modo "token-only" via API route.
      if (!sessionData.session) {
        if (!recoveryToken) {
          setError("Link inválido ou expirado. Solicite um novo reset de senha.");
          return;
        }

        const res = await fetch("/api/auth/reset-via-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: recoveryToken, new_password: p1 }),
        });

        const json = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        if (!res.ok) {
          setError(json?.error || json?.details || "Não foi possível atualizar a senha. Tente novamente.");
          return;
        }
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password: p1 });
        if (updateError) {
          setError("Não foi possível atualizar a senha. Tente novamente.");
          return;
        }
      }

      setSuccess("Senha redefinida com sucesso. Você já pode fazer login.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível atualizar a senha.";
      if (msg === "Failed to fetch" || /failed to fetch/i.test(msg)) {
        setError(
          "Não foi possível conectar ao Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY e sua conectividade."
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#041a49] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-[#0b1a3c]">Definir nova senha</h1>
          <p className="mt-1 text-sm text-gray-600">Crie uma nova senha para sua conta.</p>

          {loading && <div className="mt-4 text-sm text-gray-700">Validando link...</div>}

          {!loading && error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
              <div className="mt-2">
                <Link href="/login/forgot-password" className="text-blue-700 hover:underline">
                  Solicitar novo link
                </Link>
              </div>
            </div>
          )}

          {!loading && ready && (
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <div>
                <label htmlFor="reset-new-password" className="block text-sm font-medium text-gray-700">
                  Nova senha
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700">
                  Confirmar nova senha
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
              {success && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-linear-to-r from-[#e53935] to-[#d81b60] py-2 text-white font-semibold shadow-md hover:opacity-90 disabled:opacity-50 transition"
              >
                {saving ? "Salvando..." : "Atualizar senha"}
              </button>

              <div className="text-center text-sm">
                <Link href="/login" className="text-blue-700 hover:underline">
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
