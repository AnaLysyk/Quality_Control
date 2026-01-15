"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { toast } from "react-hot-toast";

type Defect = {
  id: string;
  title: string;
  status: string;
  origin: "manual" | "automatico";
  url?: string;
  createdBy?: string | null;
  created_at?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  run?: string | null;
};

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "fail", label: "Em falha" },
  { id: "blocked", label: "Bloqueado" },
  { id: "pending", label: "Aguardando teste" },
  { id: "done", label: "Concluído" },
];

const ORIGIN_OPTIONS: { id: "all" | "manual" | "automatico"; label: string }[] = [
  { id: "all", label: "Todas as origens" },
  { id: "manual", label: "Manuais" },
  { id: "automatico", label: "Automáticos (Qase)" },
];

const FALLBACK: Defect[] = [
  {
    id: "df-1",
    title: "Checkout falha ao finalizar pagamento PIX",
    status: "fail",
    origin: "automatico",
    url: "https://app.qase.io/run/123",
    companySlug: "griaule",
    companyName: "Griaule",
    createdBy: "Qase",
    created_at: "2024-12-01",
    run: "run-123",
  },
  {
    id: "df-2",
    title: "API de documentos intermitente",
    status: "blocked",
    origin: "manual",
    companySlug: "griaule",
    companyName: "Griaule",
    createdBy: "ana.souza",
    created_at: "2024-12-02",
    run: "run-456",
  },
  {
    id: "df-3",
    title: "Upload de nota fiscal sem progress bar",
    status: "pending",
    origin: "manual",
    companySlug: "mobilecorp",
    companyName: "MobileCorp",
    createdBy: "carlos.melo",
    created_at: "2024-12-03",
    run: "run-789",
  },
];

const STATUS_LABEL: Record<string, string> = {
  fail: "Em falha",
  blocked: "Bloqueado",
  pending: "Aguardando teste",
  done: "Concluído",
};

export default function AdminDefeitosEmpresaPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "empresa";
  const [items, setItems] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState<"all" | "manual" | "automatico">("all");
  const [userFilter, setUserFilter] = useState("");

  function handleUnauthorized() {
    const msg = "Sessão expirada. Faça login novamente.";
    setAuthBlocked(true);
    setError(msg);
    toast.error(msg);
    router.push("/login");
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setAuthBlocked(false);
      try {
        const res = await fetch(`/api/admin/defeitos?company=${encodeURIComponent(slug)}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (res.status === 401) {
          setItems([]);
          handleUnauthorized();
          return;
        }
        if (res.status === 403) {
          setItems([]);
          setAuthBlocked(true);
          setError("Sem permissão");
          return;
        }

        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as unknown;
          const rec = (json ?? null) as Record<string, unknown> | null;
          const apiError = typeof rec?.error === "string" ? rec.error : null;
          setItems([]);
          setError(apiError || "Erro ao carregar defeitos");
          return;
        }

        const json = (await res.json().catch(() => null)) as unknown;
        const rec = (json ?? null) as Record<string, unknown> | null;
        const list = Array.isArray((rec as any)?.items) ? ((rec as any).items as Defect[]) : null;
        if (Array.isArray(list) && list.length) {
          setItems(list);
        } else {
          const fallback = FALLBACK.filter((d) => (d.companySlug || "") === slug);
          setItems(fallback.length ? fallback : FALLBACK);
        }
        const apiError = typeof rec?.error === "string" ? rec.error : null;
        if (apiError) setError(apiError);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar defeitos");
        const fallback = FALLBACK.filter((d) => (d.companySlug || "") === slug);
        setItems(fallback.length ? fallback : FALLBACK);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const filtered = useMemo(() => {
    if (authBlocked) return [];
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (originFilter !== "all" && item.origin !== originFilter) return false;
      if (userFilter && !`${item.createdBy || ""}`.toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });
  }, [items, statusFilter, originFilter, userFilter, authBlocked]);

  const companyName =
    items[0]?.companyName ||
    slug
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  return (
    <RequireGlobalAdmin>
      <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c) p-6 md:p-10 space-y-6">
        <button className="text-sm text-(--tc-accent,#ef0001) hover:underline" onClick={() => router.push("/admin/defeitos")}>
          ← Voltar
        </button>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Defeitos</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-(--tc-text-primary,#0b1a3c)">
            {companyName} — lista de defeitos
          </h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            Manual + automáticos (Qase), com filtros por status, origem e usuário.
          </p>
        </div>

        <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 sm:p-6 shadow-sm space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <FilterSelect label="Origem" value={originFilter} onChange={(v) => setOriginFilter(v as any)} options={ORIGIN_OPTIONS} />
            <FilterInput label="Usuário" value={userFilter} onChange={setUserFilter} placeholder="Criado por" />
          </div>
        </div>

        <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-(--tc-text-primary,#0b1a3c)">Defeitos</h2>
            <span className="text-sm text-(--tc-text-muted,#6b7280)">{filtered.length} itens</span>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando defeitos...</p>}
          {!loading && filtered.length === 0 && <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum defeito encontrado.</p>}
          {!loading && filtered.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((d) => (
                <article
                  key={d.id}
                  className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 shadow-sm space-y-2 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-(--tc-text-primary,#0b1a3c) truncate" title={d.title}>
                        {d.title}
                      </p>
                      <p className="text-xs text-(--tc-text-secondary,#4b5563)">Origem: {d.origin === "manual" ? "Manual" : "Automática"}</p>
                    </div>
                    <span className={statusBadge(d.status)}>{STATUS_LABEL[d.status] ?? d.status}</span>
                  </div>
                  <div className="text-xs text-(--tc-text-secondary,#4b5563) space-y-1">
                    {d.run && <p>Run: {d.run}</p>}
                    {d.createdBy && <p>Criado por: {d.createdBy}</p>}
                    {d.created_at && <p>Data: {d.created_at}</p>}
                  </div>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                    >
                      Abrir link
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </RequireGlobalAdmin>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="grid gap-1 text-sm text-(--tc-text-secondary,#4b5563)">
      {label}
      <select
        className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-(--tc-text-primary,#0b1a3c)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm text-(--tc-text-secondary,#4b5563)">
      {label}
      <input
        className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-(--tc-text-primary,#0b1a3c)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function statusBadge(status: string) {
  const base = "text-xs font-semibold rounded-full px-2 py-0.5";
  if (status === "fail") return `${base} bg-red-100 text-red-700 border border-red-200`;
  if (status === "blocked") return `${base} bg-amber-100 text-amber-700 border border-amber-200`;
  if (status === "pending") return `${base} bg-blue-100 text-blue-700 border border-blue-200`;
  if (status === "done") return `${base} bg-emerald-100 text-emerald-700 border border-emerald-200`;
  return `${base} bg-slate-100 text-slate-700 border border-slate-200`;
}
