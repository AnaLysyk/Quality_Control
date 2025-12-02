"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff } from "react-icons/fi";

const griauleLogo = "/images/griaule.svg";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user, password }),
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Senha incorreta.");
        setLoading(false);
        return;
      }

      localStorage.setItem("auth_ok", "true");
      router.replace("/dashboard");
    } catch (err) {
      setError("Erro ao entrar. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto font-['Segoe_UI','Helvetica','Arial',sans-serif]">
      <div className="flex flex-col items-center gap-3 mb-6">
        <Image
          src={griauleLogo}
          alt="Griaule"
          width={340}
          height={120}
          className="w-64 h-auto drop-shadow-[0_0_22px_rgba(124,211,67,0.35)]"
          priority
        />
        <p className="text-sm text-gray-200 text-center">
          Acesse o painel QA para visualizar gráficos e releases.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg shadow-2xl p-8">

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-gray-100">
            Usuario
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7CD343]/60 focus:border-[#7CD343]/60 transition"
              placeholder="Digite o usuario"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-gray-100">
            Senha
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 pr-12 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7CD343]/60 focus:border-[#7CD343]/60 transition"
                placeholder="Digite a senha"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-300 hover:text-white transition"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </label>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-[#7CD343] hover:bg-[#6ab534] text-black font-semibold px-4 py-3 disabled:bg-[#7CD343]/60 disabled:cursor-not-allowed transition shadow-lg shadow-[#7CD343]/30"
          >
            {loading ? "Entrando..." : "Acessar"}
          </button>
        </form>
      </div>
    </div>
  );
}
