"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const { refreshUser } = useAuthUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [accessCompany, setAccessCompany] = useState("");
  const [accessCompanyId, setAccessCompanyId] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState("");
  const [accessName, setAccessName] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessType, setAccessType] = useState<"Usuário da empresa" | "Admin do sistema" | "Admin da empresa">(
    "Usuário da empresa",
  );
  const [accessNotes, setAccessNotes] = useState("");
  const [publicClients, setPublicClients] = useState<Array<{ id: string; name: string }>>([]);
  const [publicClientsLoading, setPublicClientsLoading] = useState(false);
  const [publicClientsError, setPublicClientsError] = useState<string | null>(null);
  const [publicClientsHint, setPublicClientsHint] = useState<string | null>(null);
  const [publicClientsShowDetails, setPublicClientsShowDetails] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyPickerActiveIndex, setCompanyPickerActiveIndex] = useState(0);
  const companyPickerId = useId();
  const companyListboxId = `${companyPickerId}-clients`;
  const refreshClientsTimerRef = useRef<number | null>(null);
  const refreshClientsAbortRef = useRef<AbortController | null>(null);

  const parseAccessType = (value: string): "Usuário da empresa" | "Admin do sistema" | "Admin da empresa" => {
    if (value === "Admin do sistema" || value === "Administrador") return "Admin do sistema";
    if (value === "Admin da empresa" || value === "Empresa") return "Admin da empresa";
    return "Usuário da empresa";
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportResult, setSupportResult] = useState<string | null>(null);
  const [supportSuccess, setSupportSuccess] = useState<{ email: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function refreshPublicClients() {
    refreshClientsAbortRef.current?.abort();
    const controller = new AbortController();
    refreshClientsAbortRef.current = controller;

    try {
      setPublicClientsLoading(true);
      setPublicClientsError(null);
      setPublicClientsHint(null);
      setPublicClientsShowDetails(false);
      const res = await fetch("/api/public/clients", { cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message =
          body && typeof body === "object" && typeof (body as any).message === "string"
            ? String((body as any).message)
            : "Nao foi possivel carregar as empresas.";
        const hint =
          body && typeof body === "object" && typeof (body as any).hint === "string" ? String((body as any).hint) : null;
        setPublicClients([]);
        setPublicClientsError(message);
        setPublicClientsHint(hint);
        return;
      }
      const body = await res.json().catch(() => ({ items: [] }));
      const items = Array.isArray(body.items) ? (body.items as unknown[]) : [];
      const mapped = items
        .map((it) => {
          const rec = (it ?? null) as Record<string, unknown> | null;
          return {
            id: typeof rec?.id === "string" ? rec.id : "",
            name: typeof rec?.name === "string" ? rec.name : "",
          };
        })
        .filter((it) => it.id && it.name);

      setPublicClients(mapped);
      setPublicClientsHint(null);
      setPublicClientsShowDetails(false);
    } catch (err) {
      // Ignore abort; otherwise fall back to empty list.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPublicClients([]);
      setPublicClientsError("Nao foi possivel carregar as empresas. Verifique a integracao.");
      setPublicClientsHint(null);
      setPublicClientsShowDetails(false);
    } finally {
      setPublicClientsLoading(false);
    }
  }

  const normalizeText = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const filteredClients = useMemo(() => {
    if (accessType === "Admin do sistema") return [];
    const qRaw = normalizeText(accessCompany);
    const tokens = qRaw.split(/\s+/).filter(Boolean);
    if (!tokens.length) return publicClients.slice(0, 10);

    const scored: Array<{ id: string; name: string; score: number }> = [];
    for (const c of publicClients) {
      const n = normalizeText(c.name);
      if (!n) continue;

      // Must match all tokens.
      if (!tokens.every((t) => n.includes(t))) continue;

      let score = 0;
      // Prefer when the full query (as typed) matches contiguously.
      if (qRaw && n.includes(qRaw)) score += 30;

      for (const t of tokens) {
        if (n === t) score += 120;
        if (n.startsWith(t)) score += 60;
        // Earlier match is better.
        const idx = n.indexOf(t);
        if (idx >= 0) score += Math.max(0, 20 - idx);
      }

      // Shorter names slightly preferred when score ties.
      score += Math.max(0, 20 - n.length / 10);

      scored.push({ ...c, score });
    }

    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"));
    return scored.slice(0, 10).map(({ id, name }) => ({ id, name }));
  }, [publicClients, accessCompany, accessType]);

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
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        const message = body.message || body.error;
        if (res.status === 400) setError(message || "Campos obrigatorios");
        else if (res.status === 401) setError(message || "Email ou senha invalidos");
        else if (res.status === 403) setError(message || "Usuario bloqueado");
        else setError(message || "Erro ao autenticar");
        return;
      }

      let target = nextParam && nextParam !== "/login" ? nextParam : "/";
      if (!nextParam) {
        try {
          // Prefer bootstrap payload (single request) to decide redirect.
          const bootstrapRes = await fetch("/api/auth/bootstrap", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          });

          const bootstrap = (await bootstrapRes.json().catch(() => null)) as
            | { ok?: boolean; user?: { clientSlug?: string | null; isAdmin?: boolean; role?: string | null } }
            | null;

          const bUser = bootstrap?.user ?? null;
          const clientSlug = (typeof bUser?.clientSlug === "string" && bUser.clientSlug) ? bUser.clientSlug : null;
          const bootstrapRole = typeof bUser?.role === "string" ? bUser.role.toLowerCase() : null;
          const isAdmin = bUser?.isAdmin === true || bootstrapRole === "admin" || bootstrapRole === "global_admin";

          if (isAdmin) {
            target = "/admin/home";
          } else if (clientSlug) {
            target = `/empresas/${clientSlug}/home`;
          } else {
            // Fallback: some setups still rely on /api/me to resolve client slug.
            const meRes = await fetch("/api/me", { credentials: "include", cache: "no-store" });
            const payload = await meRes.json().catch(() => null);
            const me = payload?.user;
            const meClientSlug = me?.clientSlug ?? me?.client?.slug ?? null;
            const meRole = typeof me?.role === "string" ? me.role.toLowerCase() : null;
            const meIsAdmin =
              me?.isGlobalAdmin === true || me?.is_global_admin === true || meRole === "admin" || meRole === "global_admin";
            if (meIsAdmin) {
              target = "/admin/home";
            } else if (meClientSlug) {
              target = `/empresas/${meClientSlug}/home`;
            }
          }
        } catch {
          /* ignore */
        }
      }
      await refreshUser();
      router.replace(target);
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
    setSupportSuccess(null);
    try {
      const submittedEmail = accessEmail;
      const res = await fetch("/api/support/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          email: accessEmail,
          company: accessCompany,
          client_id: accessCompanyId,
          role: accessRole,
          name: accessName,
          access_type: accessType,
          notes: accessNotes,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setError(body.message || body.error || "Nao foi possivel enviar a solicitacao");
        return;
      }
      setSupportResult("Solicitacao enviada.");
      setSupportSuccess({ email: submittedEmail });
      setShowSupport(false);
      setAccessCompany("");
      setAccessCompanyId(null);
      setAccessRole("");
      setAccessName("");
      setAccessEmail("");
      setAccessNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar solicitacao");
    }
  }

  useEffect(() => {
    if (!showSupport) return;
    return () => {
      refreshClientsAbortRef.current?.abort();
      if (refreshClientsTimerRef.current) {
        window.clearTimeout(refreshClientsTimerRef.current);
        refreshClientsTimerRef.current = null;
      }
    };
  }, [showSupport]);

  useEffect(() => {
    if (!showSupport) return;
    refreshPublicClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSupport]);

  const companyPickerVisible =
    accessType !== "Admin do sistema" &&
    companyPickerOpen &&
    accessCompany.trim().length > 0 &&
    filteredClients.length > 0;

  useEffect(() => {
    // Never keep the dropdown open when there's no query or no matches.
    if (!accessCompany.trim() || filteredClients.length === 0) {
      if (companyPickerOpen) setCompanyPickerOpen(false);
      setCompanyPickerActiveIndex(0);
    } else if (!companyPickerOpen) {
      // Open automatically once there are matches and the user typed something.
      setCompanyPickerOpen(true);
    }
  }, [accessCompany, filteredClients.length, companyPickerOpen]);

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

      <div className="relative z-10 w-full max-w-md bg-white shadow-2xl rounded-xl overflow-visible">
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
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-full border px-4 py-2 pr-11 bg-[#f5f8ff] focus:outline-none focus:ring-2 focus:ring-red-500/70"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="********"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 transition hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a21.77 21.77 0 0 1 5.06-6.88" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a21.77 21.77 0 0 1-2.82 4.44" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-linear-to-r from-[#e53935] to-[#d81b60] py-2 text-white font-semibold shadow-md hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "Entrando..." : "Login"}
            </button>

            <div className="text-center text-sm">
              <Link href="/login/forgot-password" className="text-blue-700 hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          </form>

          <div className="mt-4 text-sm flex justify-between items-center">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="px-3 text-gray-500 text-xs">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="mt-2 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setShowSupport((v) => {
                  const next = !v;
                  if (next) {
                    setSupportSuccess(null);
                    setSupportResult(null);
                    setError(null);
                    // Preenche o e-mail com o que o usuário digitou no login (se houver)
                    setAccessEmail((prev) => prev || email);
                  }
                  return next;
                });
              }}
              className="inline-flex justify-center text-blue-700 hover:underline"
            >
              Solicitar acesso ao admin
            </button>
          </div>

          {supportSuccess && !showSupport && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
              <p className="text-sm font-semibold text-emerald-900">Solicitacao enviada com sucesso</p>
              <p className="mt-1 text-sm text-emerald-900/90">
                Vamos usar este e-mail para comunicar o andamento: <span className="font-semibold">{supportSuccess.email}</span>
              </p>
              <p className="mt-1 text-sm text-emerald-900/85">
                Se a solicitacao for aprovada, voce recebera um link para criar sua senha de acesso. Fique atento(a) a caixa de entrada e ao spam.
              </p>
            </div>
          )}

          {showSupport && (
            <form className="mt-3 border-t pt-3" onSubmit={handleSupport}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <p className="text-sm text-gray-700 sm:col-span-2">
                  Preencha os dados para solicitar acesso ao administrador.
                </p>

                <div>
                  <label className="block text-xs text-gray-600">Selecionar acesso</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                    value={accessType}
                    onChange={(e) => setAccessType(parseAccessType(e.target.value))}
                    aria-label="Selecionar acesso"
                    title="Selecionar acesso"
                  >
                    <option value="Usuário da empresa">Usuário da empresa</option>
                    <option value="Admin da empresa">Admin da empresa</option>
                    <option value="Admin do sistema">Admin do sistema</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600">Cargo que exerce</label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                    placeholder="Ex: QA, PO, Desenvolvedor(a)"
                    value={accessRole}
                    onChange={(e) => setAccessRole(e.target.value)}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600">Empresa que sera vinculada</label>
                  <div className="relative">
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                      placeholder="Digite para buscar a empresa"
                      value={accessCompany}
                      onChange={(e) => {
                        const next = e.target.value;
                        setAccessCompany(next);
                        if (accessCompanyId) setAccessCompanyId(null);
                        setCompanyPickerActiveIndex(0);

                        // Keep the list always updated with platform companies (debounced).
                        if (refreshClientsTimerRef.current) window.clearTimeout(refreshClientsTimerRef.current);
                        refreshClientsTimerRef.current = window.setTimeout(() => {
                          refreshPublicClients();
                        }, 300);
                      }}
                      onKeyDown={(e) => {
                        if (accessType === "Admin do sistema") return;
                        if (!companyPickerVisible && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                          // Only open if there are matches and the user typed something.
                          return;
                        }

                        if (e.key === "Escape") {
                          setCompanyPickerOpen(false);
                          return;
                        }

                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          const next = Math.min(companyPickerActiveIndex + 1, Math.max(0, filteredClients.length - 1));
                          setCompanyPickerActiveIndex(next);
                          return;
                        }

                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          const next = Math.max(companyPickerActiveIndex - 1, 0);
                          setCompanyPickerActiveIndex(next);
                          return;
                        }

                        if (e.key === "Enter" && companyPickerVisible && filteredClients.length > 0) {
                          e.preventDefault();
                          const selected = filteredClients[companyPickerActiveIndex] ?? filteredClients[0];
                          if (selected) {
                            setAccessCompany(selected.name);
                            setAccessCompanyId(selected.id);
                          }
                          setCompanyPickerOpen(false);
                        }
                      }}
                      onBlur={() => {
                        // Delay closing to allow click selection.
                        setTimeout(() => setCompanyPickerOpen(false), 120);
                      }}
                      disabled={accessType === "Admin do sistema"}
                      required={accessType !== "Admin do sistema"}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={companyPickerVisible}
                      aria-controls={companyListboxId}
                      aria-activedescendant={
                        companyPickerVisible && filteredClients[companyPickerActiveIndex]
                          ? `${companyPickerId}-opt-${filteredClients[companyPickerActiveIndex].id}`
                          : undefined
                      }
                    />

                    {accessType !== "Admin do sistema" && (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-gray-500">
                          {publicClientsLoading
                            ? "Carregando empresas..."
                            : `${publicClients.length} empresa(s) carregada(s)`}
                          {publicClientsError ? " • Nao foi possivel carregar as empresas" : ""}
                        </div>
                        <button
                          type="button"
                          className="text-[11px] text-blue-700 hover:underline disabled:text-gray-400"
                          onClick={() => refreshPublicClients()}
                          disabled={publicClientsLoading}
                        >
                          Recarregar
                        </button>
                      </div>
                    )}

                    {accessType !== "Admin do sistema" && publicClientsError && process.env.NODE_ENV !== "production" && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        <button
                          type="button"
                          className="text-blue-700 hover:underline"
                          onClick={() => setPublicClientsShowDetails((v) => !v)}
                        >
                          {publicClientsShowDetails ? "Ocultar detalhes" : "Ver detalhes"}
                        </button>
                        {publicClientsShowDetails && (
                          <div className="mt-1 whitespace-pre-wrap text-gray-500">
                            {publicClientsError}
                            {publicClientsHint ? `\n${publicClientsHint}` : ""}
                          </div>
                        )}
                      </div>
                    )}

                    {accessType !== "Admin do sistema" && companyPickerVisible && (
                      <div
                        id={companyListboxId}
                        role="listbox"
                        className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto"
                      >
                        {filteredClients.map((c, idx) => {
                          const active = idx === companyPickerActiveIndex;
                          return (
                            <button
                              key={c.id}
                              id={`${companyPickerId}-opt-${c.id}`}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`w-full text-left px-3 py-2 text-sm transition ${
                                active ? "bg-slate-100" : "hover:bg-slate-50"
                              }`}
                              onMouseEnter={() => setCompanyPickerActiveIndex(idx)}
                              onMouseDown={(ev) => {
                                // Prevent blur before selection.
                                ev.preventDefault();
                              }}
                              onClick={() => {
                                setAccessCompany(c.name);
                                setAccessCompanyId(c.id);
                                setCompanyPickerOpen(false);
                              }}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {accessType !== "Admin do sistema" && accessCompany.trim().length > 0 && filteredClients.length === 0 && !publicClientsLoading && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        {publicClients.length === 0
                          ? publicClientsError
                            ? "Nao foi possivel carregar as empresas. Clique em Recarregar."
                            : "Nenhuma empresa cadastrada ainda. Clique em Recarregar."
                          : "Nenhuma empresa compativel encontrada"}
                      </p>
                    )}

                    {accessType !== "Admin do sistema" && accessCompanyId && (
                      <p className="mt-1 text-[11px] text-gray-500">Empresa selecionada da lista</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600">Nome</label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                    placeholder="Ex: Ana Souza"
                    value={accessName}
                    onChange={(e) => setAccessName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600">E-mail</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                    placeholder="seu@email.com"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600">Observacoes (opcional)</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                    rows={3}
                    placeholder="Ex: Preciso de acesso para acompanhar execucoes"
                    value={accessNotes}
                    onChange={(e) => setAccessNotes(e.target.value)}
                  />
                </div>

                {supportResult && <div className="text-sm text-green-600 sm:col-span-2">{supportResult}</div>}
                {error && !supportResult && <div className="text-sm text-red-600 sm:col-span-2">{error}</div>}

                <button
                  type="submit"
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 sm:col-span-2 sm:justify-self-end"
                  disabled={!(
                    accessEmail &&
                    accessRole &&
                    accessName &&
                    (accessType === "Admin do sistema" || accessCompany || accessCompanyId)
                  )}
                >
                  Enviar solicitacao
                </button>
              </div>
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
