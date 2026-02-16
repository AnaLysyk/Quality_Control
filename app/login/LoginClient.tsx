"use client";


import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./LoginClient.module.css";


export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuthUser();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user, password }),
      });
      if (res.ok) {
        await refreshUser();
        const nextParam = searchParams?.get("next");
        router.push(nextParam && nextParam.startsWith("/") ? nextParam : "/empresas");
      } else {
        const data = await res.json().catch(() => null);
        setError((data?.error as string) || "Erro ao autenticar");
      }
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.bgLoginPremium + " min-h-screen flex items-center justify-center relative overflow-hidden"}>
      {/* Animated bubbles premium */}
      <div className={styles.bubblePremium + ' ' + styles.bubble1}></div>
      <div className={styles.bubblePremium + ' ' + styles.bubble2}></div>
      <div className={styles.bubblePremium + ' ' + styles.bubble3}></div>
      <div className={styles.bubblePremium + ' ' + styles.bubble4}></div>

      <div className="flex flex-col items-center gap-8 relative z-10">
        {/* Premium logo */}
        <div className={styles.logoEnergyPremium}>
          <div className={styles.logoHalo}></div>
          <div className={styles.logoGradientAnimated}></div>
          <div className={styles.logoGlass}></div>
          <div className={styles.logoInner}>
            <Image src="/logo.svg" alt="Logo" fill className="object-contain" />
          </div>
        </div>

        {/* Premium login card */}
        <form className={styles.loginCardPremium + " w-full max-w-md space-y-5"} onSubmit={handleSubmit} autoComplete="off">
          <h1 className={styles.title}>Login</h1>
          <label className={styles.label} htmlFor="user">Usuário</label>
          <input
            className={styles.inputPremium}
            id="user"
            type="text"
            value={user}
            onChange={e => setUser(e.target.value)}
            autoFocus
            autoComplete="username"
            disabled={loading}
          />
          <label className={styles.label} htmlFor="password">Senha</label>
          <input
            className={styles.inputPremium}
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button
            className={styles.loginButtonPremium}
            type="submit"
            disabled={loading}
          >
            {loading && <span className={styles.spinner} />}
            <span className={loading ? styles.buttonTextHidden : ""}>
              Entrar
            </span>
          </button>
          <div className={styles.links}>
            <Link href="/reset-password" className={styles.link}>Esqueceu a senha?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
