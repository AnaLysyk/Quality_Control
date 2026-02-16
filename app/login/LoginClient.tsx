"use client";


import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./LoginClient.module.css";
import logo from "@/public/logo.svg";

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
        body: JSON.stringify({ user, password }),
      });
      if (res.ok) {
        await refreshUser();
        const nextParam = searchParams?.get("next") ?? null;
        // Redirecionamento simplificado
        router.push("/empresas");
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
    <div className={styles.wall}>
      {/* Animated bubbles */}
      <div className={styles.bubble + ' ' + styles.bubble1}></div>
      <div className={styles.bubble + ' ' + styles.bubble2}></div>
      <div className={styles.bubble + ' ' + styles.bubble3}></div>
      <div className={styles.bubble + ' ' + styles.bubble4}></div>

      {/* Centered spinning logo */}
      <div className={styles.logoSpin}>
        <Image src={logo} alt="Logo" width={120} height={120} priority />
      </div>

      {/* Login form */}
      <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
        <h1 className={styles.title}>Login</h1>
        <label className={styles.label} htmlFor="user">Usuário</label>
        <input
          className={styles.input}
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
          className={styles.input}
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <div className={styles.links}>
          <Link href="/reset-password" className={styles.link}>Esqueceu a senha?</Link>
        </div>
      </form>
    </div>
  );
}
