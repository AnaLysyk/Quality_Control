"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/clientes";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [showSupport, setShowSupport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportResult, setSupportResult] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 400) setError(body.message || "Campos obrigatorios");
        else if (res.status === 401) setError(body.message || "Email ou senha invalidos");
        else if (res.status === 403) setError(body.message || "Usuario bloqueado");
        else setError(body.message || "Erro ao autenticar");
        return;
      }
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSupport(e: FormEvent) {
    e.preventDefault();
    setSupportResult(null);
    setError(null);
    try {
      const res = await fetch("/api/support/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message: supportMessage }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Nao foi possivel enviar a solicitacao");
        return;
      }
      setSupportResult("Solicitacao enviada. O administrador sera notificado.");
      setSupportMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar solicitacao");
    }
  }

  // Canvas de partículas em movimento
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const count = 80;
    const maxDist = 170;
    let frame = 0;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const init = () => {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1,
        });
      }
    };

    const step = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.95)";

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= width) p.vx *= -1;
        if (p.y <= 0 || p.y >= height) p.vy *= -1;
      }

      // linhas
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = 1 - dist / maxDist;
            ctx.strokeStyle = `rgba(107,125,183,${alpha * 0.95})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // pontos
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(step);
    };

    resize();
    init();
    frame = requestAnimationFrame(step);
    const resizeHandler = () => {
      resize();
      init();
    };
    window.addEventListener("resize", resizeHandler);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#041a49] overflow-hidden">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" />

      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl rounded-xl overflow-hidden">
        <div className="flex flex-col justify-center px-8 py-10 bg-white">
          <div className="flex items-center gap-3 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/tc.png" alt="Testing Company" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm text-gray-500">Bem-vindo(a) ao</p>
              <h2 className="text-xl font-semibold text-[#0b1a3c]">Painel Testing Metric</h2>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm text-gray-700">Usuario</label>
              <input
                type="email"
                className="mt-1 w-full rounded-full border px-4 py-2 bg-[#f5f8ff] focus:outline-none focus:ring-2 focus:ring-red-500/70"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Matricula ou e-mail"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700">Senha</label>
              <input
                type="password"
                className="mt-1 w-full rounded-full border px-4 py-2 bg-[#f5f8ff] focus:outline-none focus:ring-2 focus:ring-red-500/70"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="********"
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-linear-to-r from-[#e53935] to-[#d81b60] py-2 text-white font-semibold shadow-md hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "Entrando..." : "Login"}
            </button>
          </form>

          <div className="mt-4 text-sm flex justify-between items-center">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="px-3 text-gray-500 text-xs">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="mt-2 text-right text-sm">
            <button
              type="button"
              onClick={() => setShowSupport((v) => !v)}
              className="text-blue-700 hover:underline"
            >
              Esqueceu sua senha?
            </button>
          </div>

          {showSupport && (
            <form className="mt-3 space-y-2 border-t pt-3" onSubmit={handleSupport}>
              <p className="text-sm text-gray-700">Descreva o problema (nao troca a senha automaticamente).</p>
              <textarea
                className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                rows={3}
                placeholder="Ex: Nao consigo acessar desde ontem..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
              />
              {supportResult && <div className="text-sm text-green-600">{supportResult}</div>}
              {error && !supportResult && <div className="text-sm text-red-600">{error}</div>}
              <button
                type="submit"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                disabled={!email}
              >
                Enviar para o administrador
              </button>
            </form>
          )}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
          <div className="h-10 w-10 border-4 border-white/40 border-t-white rounded-full animate-spin" />
          <p>Carregando...</p>
        </div>
      )}
    </div>
  );
}
