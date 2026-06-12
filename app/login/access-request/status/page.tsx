"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import styles from "../../LoginClient.module.css";
import requestStyles from "../AccessRequestClient.module.css";

type Comment = {
  id: string;
  authorRole: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type RequestPublic = {
  id: string;
  status: string;
  requestType: string;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requestedCompanyId?: string;
  requesterName?: string;
  requesterEmail: string;
  reason?: string;
  reviewComment?: string;
  adjustmentFields: string[];
  adjustmentHistory: Array<{
    round: number;
    requestedAt: string;
    requestedFields: string[];
    requestMessage?: string;
    fieldComments?: Record<string, string>;
    requesterReturnedAt?: string;
  }>;
  lastAdjustmentAt?: string;
  details: {
    username?: string;
    phone?: string;
    jobRole?: string;
    title?: string;
    description?: string;
    notes?: string;
    company?: Record<string, string>;
  };
  createdAt: string;
  updatedAt: string;
};

type CompanyOption = { id: string; name: string };

const STATUS = {
  pending: {
    label: "Aguardando análise",
    text: "Sua solicitação foi recebida e aguarda análise. As atualizações serão enviadas por e-mail.",
    tone: "border-amber-300 bg-amber-50/95 text-amber-950",
    accent: "bg-amber-500",
    iconTone: "border-amber-300 bg-amber-100",
  },
  under_review: {
    label: "Em análise",
    text: "Sua correção foi recebida e voltou para análise. As atualizações serão enviadas por e-mail.",
    tone: "border-blue-300 bg-blue-50/95 text-blue-950",
    accent: "bg-blue-600",
    iconTone: "border-blue-300 bg-blue-100",
  },
  needs_more_info: {
    label: "Ajuste necessário",
    text: "Corrija somente os campos destacados e reenvie para análise.",
    tone: "border-orange-300 bg-orange-50/95 text-orange-950",
    accent: "bg-orange-600",
    iconTone: "border-orange-300 bg-orange-100",
  },
  approved: {
    label: "Aprovado",
    text: "Sua solicitação foi aprovada. As instruções de acesso foram enviadas por e-mail.",
    tone: "border-emerald-300 bg-emerald-50/95 text-emerald-950",
    accent: "bg-emerald-600",
    iconTone: "border-emerald-300 bg-emerald-100",
  },
  rejected: {
    label: "Rejeitado",
    text: "Sua solicitação foi rejeitada. Consulte o motivo informado pela equipe.",
    tone: "border-red-300 bg-red-50/95 text-red-950",
    accent: "bg-red-600",
    iconTone: "border-red-300 bg-red-100",
  },
  cancelled: {
    label: "Cancelado",
    text: "Esta solicitação foi cancelada.",
    tone: "border-slate-300 bg-slate-100/95 text-slate-900",
    accent: "bg-slate-600",
    iconTone: "border-slate-300 bg-slate-200",
  },
  expired: {
    label: "Expirado",
    text: "Esta solicitação expirou.",
    tone: "border-slate-300 bg-slate-100/95 text-slate-900",
    accent: "bg-slate-600",
    iconTone: "border-slate-300 bg-slate-200",
  },
} as const;

const FIELD_LABELS: Record<string, string> = {
  profileType: "Tipo de perfil",
  company: "Empresa",
  companyName: "Razão social",
  companyTaxId: "CNPJ",
  companyZip: "CEP",
  companyAddress: "Endereço",
  companyPhone: "Telefone da empresa",
  companyWebsite: "Website",
  companyLinkedin: "LinkedIn",
  companyDescription: "Descrição da empresa",
  companyNotes: "Observações da empresa",
  fullName: "Nome completo",
  username: "Usuário/login",
  email: "E-mail",
  phone: "Telefone",
  jobRole: "Cargo",
  title: "Título",
  description: "Descrição",
  notes: "Observações",
  password: "Nova senha",
};

const FORM_CONTROL_CLASS =
  "mt-2 w-full appearance-none rounded-xl border border-[#011848]/15 bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#011848] shadow-[inset_0_1px_2px_rgba(1,24,72,0.04)] outline-none transition placeholder:text-[#64748b]/70 hover:border-[#011848]/30 focus:border-[#ef0001] focus:bg-white focus:ring-4 focus:ring-[#ef0001]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const ADJUSTMENT_CONTROL_CLASS =
  "mt-2 w-full appearance-none rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm font-semibold text-[#011848] shadow-[inset_0_1px_2px_rgba(1,24,72,0.04)] outline-none transition placeholder:text-[#64748b]/70 hover:border-red-300 focus:border-[#ef0001] focus:bg-white focus:ring-4 focus:ring-[#ef0001]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(1,24,72,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(1,24,72,0.24)] focus:outline-none focus:ring-4 focus:ring-[#ef0001]/20 disabled:cursor-not-allowed disabled:from-[#8793aa] disabled:to-[#a3adc0] disabled:shadow-none disabled:hover:translate-y-0";

const DANGER_BUTTON_CLASS =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-[#ef0001]/35 bg-white px-5 py-3 text-sm font-black text-[#d50000] transition hover:border-[#ef0001] hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-[#ef0001]/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400";

function profileLabel(role?: string) {
  if (role === "empresa") return "Empresa";
  if (role === "company_user") return "Usuário da empresa";
  if (role === "testing_company_user") return "Usuário Testing Company";
  if (role === "leader_tc") return "Líder TC";
  if (role === "technical_support") return "Suporte técnico";
  return role || "Perfil solicitado";
}

function dateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}

function Logo() {
  return (
    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-r from-[#011848] to-[#ef0001] shadow-lg">
      <div className="relative h-12 w-12">
        <Image
          src="/images/tc.png"
          alt="Logo Quality Control"
          fill
          sizes="48px"
          priority
          className="animate-spin-slower pointer-events-none select-none object-contain object-center motion-reduce:animate-none"
        />
      </div>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-6 top-6 h-32 w-32 rounded-full bg-[#011848] opacity-20 blur-2xl animate-ping motion-reduce:animate-none" />
      <div className="absolute bottom-6 right-6 h-28 w-28 rounded-full bg-[#ef0001] opacity-20 blur-2xl animate-pulse motion-reduce:animate-none" />
      <div className="absolute right-1/5 top-1/6 h-20 w-20 rounded-full bg-[#ef0001] opacity-10 blur-lg animate-bounce delay-1000 motion-reduce:animate-none" />
      <div className="absolute bottom-1/6 left-1/5 h-24 w-24 rounded-full bg-[#011848] opacity-10 blur-lg animate-pulse delay-700 motion-reduce:animate-none" />
      <div className="absolute left-44 top-10 h-16 w-16 rounded-full bg-[#ef0001] opacity-10 blur animate-pulse delay-500 motion-reduce:animate-none" />
      <div className="absolute bottom-2 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-[#011848] opacity-10 blur animate-bounce delay-200 motion-reduce:animate-none" />
      <div className="absolute left-2 top-1/2 h-14 w-14 rounded-full bg-[#ef0001] opacity-10 blur animate-pulse delay-800 motion-reduce:animate-none" />
      <div className="absolute right-2 top-1/2 h-14 w-14 rounded-full bg-[#011848] opacity-10 blur animate-ping delay-600 motion-reduce:animate-none" />
    </div>
  );
}

function FloatingNotice({
  type,
  message,
  onClose,
}: {
  type: "error" | "success";
  message: string;
  onClose: () => void;
}) {
  const isError = type === "error";

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-70 flex justify-center sm:inset-x-auto sm:right-5 sm:justify-end">
      <div
        className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border bg-white shadow-[0_20px_60px_rgba(1,24,72,0.28)] ${requestStyles.toast} ${
          isError ? "border-red-300" : "border-emerald-300"
        }`}
        role="status"
        aria-live={isError ? "assertive" : "polite"}
        data-testid={`access-request-notice-${type}`}
      >
        <div className="flex items-start gap-3 p-4 pr-12">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
            aria-hidden="true"
          >
            {isError ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 8v5" strokeLinecap="round" />
                <path d="M12 17h.01" strokeLinecap="round" />
                <path d="M10.3 3.8 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m5 12.5 4.2 4.2L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={`text-sm font-black ${isError ? "text-red-900" : "text-emerald-900"}`}>
              {isError ? "Atenção" : "Tudo certo"}
            </p>
            <p className="mt-1 wrap-break-word text-sm font-semibold leading-5 text-slate-700">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#011848]/20"
          aria-label="Fechar aviso"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
          </svg>
        </button>
        <div
          className={`absolute inset-x-0 bottom-0 h-1 ${isError ? "bg-red-600" : "bg-emerald-600"} ${requestStyles.toastProgress}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function Info({ label, value, testId }: { label: string; value?: string; testId?: string }) {
  return (
    <div className="rounded-2xl border border-[#011848]/10 bg-white p-4 shadow-[0_5px_16px_rgba(1,24,72,0.04)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748b]">{label}</p>
      <p className="mt-2 wrap-break-word text-sm font-bold text-[#011848]" data-testid={testId}>
        {value || "-"}
      </p>
    </div>
  );
}

function StatusContent() {
  const params = useSearchParams();
  const router = useRouter();
  const accessKey = params.get("key") ?? "";
  const [item, setItem] = useState<RequestPublic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    if (!accessKey) {
      setError("Chave de acesso não informada.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/access-requests/by-key/${encodeURIComponent(accessKey)}`, {
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.item) {
        throw new Error(body?.message || "Solicitação não encontrada.");
      }
      setItem(body.item);
      setComments(Array.isArray(body.comments) ? body.comments : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao consultar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accessKey]);

  useEffect(() => {
    if (!item || item.status !== "needs_more_info") return;
    const company = item.details?.company ?? {};
    const values: Record<string, string> = {
      profileType: item.requestedRole ?? "",
      company: item.requestedCompanySlug ?? "",
      companyId: item.requestedCompanyId ?? "",
      companyName: company.companyName ?? "",
      companyTaxId: company.cnpj ?? "",
      companyZip: company.cep ?? "",
      companyAddress: company.address ?? "",
      companyPhone: company.phone ?? "",
      companyWebsite: company.website ?? "",
      companyLinkedin: company.linkedin ?? "",
      companyDescription: company.description ?? "",
      companyNotes: company.notes ?? "",
      fullName: item.requesterName ?? "",
      username: item.details.username ?? "",
      email: item.requesterEmail,
      phone: item.details.phone ?? "",
      jobRole: item.details.jobRole ?? "",
      title: item.details.title ?? "",
      description: item.details.description ?? item.reason ?? "",
      notes: item.details.notes ?? "",
      password: "",
    };
    setDraft(values);
    if (item.adjustmentFields.includes("company")) {
      void fetch("/api/public/clients", { cache: "no-store" })
        .then((response) => response.json())
        .then((body) => {
          const list = Array.isArray(body?.items) ? body.items : [];
          setCompanies(
            list
              .map((company: Record<string, unknown>) => ({
                id: String(company.id ?? ""),
                name: String(company.name ?? company.company_name ?? ""),
              }))
              .filter((company: CompanyOption) => company.id && company.name),
          );
        })
        .catch(() => setCompanies([]));
    }
  }, [item]);

  useEffect(() => {
    if (!cancelOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setCancelOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, cancelOpen]);

  useEffect(() => {
    if (!item || (!error && !feedback)) return;

    const timeoutId = window.setTimeout(() => {
      setError(null);
      setFeedback(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [error, feedback, item]);

  const status = item ? STATUS[item.status as keyof typeof STATUS] ?? STATUS.pending : STATUS.pending;
  const finalStatus = item ? ["approved", "rejected", "cancelled", "expired"].includes(item.status) : false;
  const latestRound = item?.adjustmentHistory?.at(-1);

  const details = useMemo(
    () => [
      ["Nome", item?.requesterName],
      ["E-mail", item?.requesterEmail],
      ["Perfil", profileLabel(item?.requestedRole)],
      ["Empresa", item?.requestedCompanySlug],
      ["Usuário/login", item?.details?.username],
      ["Telefone", item?.details?.phone],
      ["Cargo", item?.details?.jobRole],
      ["Título", item?.details?.title],
      ["Descrição", item?.details?.description ?? item?.reason],
    ] as Array<[string, string | undefined]>,
    [item],
  );

  async function submitAdjustment() {
    if (!item) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/access-requests/by-key/${encodeURIComponent(accessKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "Não foi possível reenviar a correção.");
      setFeedback("Correção reenviada. A solicitação voltou para análise.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao reenviar correção.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReply() {
    if (!item || !reply.trim()) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/support/access-request/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey,
          name: item.requesterName,
          email: item.requesterEmail,
          comment: reply.trim(),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Não foi possível enviar o comentário.");
      setReply("");
      setFeedback("Comentário enviado para a equipe.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao enviar comentário.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/access-requests/by-key/${encodeURIComponent(accessKey)}/cancel`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "Não foi possível cancelar.");
      setCancelOpen(false);
      setFeedback("Solicitação cancelada.");
      await load();
    } catch (caught) {
      setCancelOpen(false);
      setError(caught instanceof Error ? caught.message : "Falha ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  const shellClass = `${styles.loginContainer} ${styles.loginFixedTheme} relative isolate min-h-svh overflow-x-hidden bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] px-4 py-10`;

  if (loading) {
    return (
      <main className={`${shellClass} flex items-center justify-center`}>
        <AnimatedBackground />
        <p className="relative z-10 inline-flex items-center gap-3 rounded-2xl border border-[#011848]/10 bg-white px-5 py-3 font-bold text-[#011848] shadow-xl">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ef0001] motion-reduce:animate-none" aria-hidden="true" />
          Carregando solicitação...
        </p>
      </main>
    );
  }
  if (!item) {
    return (
      <main className={`${shellClass} flex items-center justify-center`}>
        <AnimatedBackground />
        <section className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-8 text-center shadow-2xl">
          <Logo />
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-[#ef0001]">Quality Control</p>
          <p className="font-semibold text-red-700" data-testid="access-request-status-error">{error}</p>
          <button className={`${PRIMARY_BUTTON_CLASS} mt-6 w-full`} onClick={() => router.push("/login")}>Voltar ao login</button>
        </section>
      </main>
    );
  }

  return (
    <main className={shellClass}>
      <AnimatedBackground />
      <section className="relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-[0_28px_80px_rgba(1,24,72,0.28)]" data-testid="access-request-status-result">
        <div className="h-2 bg-linear-to-r from-[#011848] via-[#142b63] to-[#ef0001]" />
        <div className="p-5 sm:p-8">
        <header className="text-center">
          <Logo />
          <p className="text-[10px] font-black uppercase tracking-[0.42em] text-[#ef0001]">Quality Control</p>
          <h1 className="mt-2 text-2xl font-black text-[#011848] sm:text-3xl">Acompanhamento da solicitação</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-[#64748b]">Consulte os dados, acompanhe a análise e fale com a equipe responsável.</p>
        </header>

        <section
          className={`relative mt-7 overflow-hidden rounded-2xl border p-5 shadow-[0_12px_30px_rgba(1,24,72,0.08)] ${status.tone}`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl ${status.accent} ${requestStyles.statusPulse}`}
            aria-hidden="true"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${status.iconTone}`}>
                <span
                  className={`h-4 w-4 rounded-full shadow-[0_0_0_5px_rgba(255,255,255,0.65)] ${status.accent} ${requestStyles.statusPulse}`}
                  aria-hidden="true"
                />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em]" data-testid="access-request-status-label">{status.label}</p>
                <p className="mt-1.5 text-sm font-semibold leading-6" data-testid="access-request-status-message">{status.text}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-current bg-white/65 px-4 py-2 text-xs font-black shadow-sm" data-testid="access-request-status-badge">
              <span className={`h-2 w-2 rounded-full ${status.accent} ${requestStyles.statusPulse}`} aria-hidden="true" />
              {status.label}
            </span>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#011848]/10 bg-[#f8fafc] p-5 shadow-[0_10px_30px_rgba(1,24,72,0.04)]">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1.5 rounded-full bg-linear-to-b from-[#011848] to-[#ef0001]" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Cadastro</p>
              <h2 className="text-lg font-black text-[#011848]">Dados da solicitação</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <Info
                key={label}
                label={label}
                value={value}
                testId={
                  label === "E-mail"
                    ? "access-request-status-email"
                    : label === "Perfil"
                      ? "access-request-status-profile"
                      : undefined
                }
              />
            ))}
            <Info label="Criada em" value={dateTime(item.createdAt)} testId="access-request-created-at" />
            <Info label="Atualizada em" value={dateTime(item.updatedAt)} testId="access-request-updated-at" />
          </div>
          <span className="sr-only" data-testid="access-request-requester-email">{item.requesterEmail}</span>
        </section>

        {item.reviewComment && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5" data-testid="access-request-review-comment">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-700">Comentário da equipe</p>
            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold text-[#011848]">{item.reviewComment}</p>
            <p className="mt-3 text-xs text-red-700">{dateTime(item.updatedAt)}</p>
          </section>
        )}

        {item.status === "needs_more_info" && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-[0_12px_32px_rgba(239,0,1,0.08)]" data-testid="access-request-status-form">
            <div className="h-1.5 bg-linear-to-r from-[#011848] to-[#ef0001]" />
            <div className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Ação necessária</p>
            <h2 className="mt-1 text-lg font-black text-[#011848]">Correção solicitada</h2>
            <p className="mt-1 text-sm font-medium text-[#64748b]">Atualize somente os campos indicados pela equipe.</p>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="access-request-adjustment-fields">
              {item.adjustmentFields.map((field) => (
                <span key={field} className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{FIELD_LABELS[field] ?? field}</span>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {item.adjustmentFields.map((field) => (
                <label key={field} className="text-sm font-bold text-[#011848]">
                  {FIELD_LABELS[field] ?? field}
                  {field === "company" ? (
                    <select
                      className={ADJUSTMENT_CONTROL_CLASS}
                      value={draft.companyId ?? ""}
                      onChange={(event) => {
                        const company = companies.find((option) => option.id === event.target.value);
                        setDraft((current) => ({ ...current, companyId: event.target.value, company: company?.name ?? "" }));
                      }}
                      data-testid={`access-request-adjust-${field}`}
                    >
                      <option value="">Selecione uma empresa</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                  ) : field === "profileType" ? (
                    <select className={ADJUSTMENT_CONTROL_CLASS} value={draft[field] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} data-testid={`access-request-adjust-${field}`}>
                      <option value="empresa">Empresa</option>
                      <option value="company_user">Usuário da empresa</option>
                      <option value="testing_company_user">Usuário TC</option>
                      <option value="leader_tc">Líder TC</option>
                      <option value="technical_support">Suporte técnico</option>
                    </select>
                  ) : field === "description" || field === "notes" || field.includes("Description") || field.includes("Notes") ? (
                    <textarea className={`${ADJUSTMENT_CONTROL_CLASS} min-h-28 resize-y`} value={draft[field] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} data-testid={`access-request-adjust-${field}`} />
                  ) : (
                    <input type={field === "password" ? "password" : field === "email" ? "email" : "text"} className={ADJUSTMENT_CONTROL_CLASS} value={draft[field] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} data-testid={`access-request-adjust-${field}`} />
                  )}
                  {latestRound?.fieldComments?.[field] && <span className="mt-1 block text-xs font-medium text-red-700">{latestRound.fieldComments[field]}</span>}
                </label>
              ))}
            </div>
            <button type="button" disabled={busy} onClick={submitAdjustment} className={`${PRIMARY_BUTTON_CLASS} mt-5 w-full`} data-testid="access-request-adjust-submit">
              {busy ? "Enviando..." : "Reenviar correção"}
            </button>
            </div>
          </section>
        )}

        {comments.length > 0 && (
          <section className="mt-5 rounded-2xl border border-[#011848]/10 bg-white p-5">
            <h2 className="text-lg font-black text-[#011848]">Histórico de mensagens</h2>
            <div className="mt-4 space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-[#f8fafc] p-4">
                  <div className="flex justify-between gap-3 text-xs font-bold text-[#64748b]"><span>{comment.authorName}</span><span>{dateTime(comment.createdAt)}</span></div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#011848]">{comment.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!finalStatus && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-[#011848]/10 bg-white shadow-[0_12px_32px_rgba(1,24,72,0.07)]">
            <div className="h-1.5 bg-linear-to-r from-[#011848] via-[#142b63] to-[#ef0001]" />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#011848] to-[#ef0001] shadow-md">
                  <div className="relative h-7 w-7">
                    <Image
                      src="/images/tc.png"
                      alt=""
                      fill
                      sizes="28px"
                      className="animate-spin-slower pointer-events-none select-none object-contain object-center motion-reduce:animate-none"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ef0001]">Canal da solicitação</p>
                  <h2 className="mt-1 text-lg font-black text-[#011848]">Fale com a equipe</h2>
                  <p className="mt-1 text-sm font-medium text-[#64748b]">Envie informações complementares sobre esta solicitação.</p>
                </div>
              </div>

              <label htmlFor="access-request-reply" className="mt-5 block text-sm font-black text-[#011848]">
                Comentário
                <textarea
                  id="access-request-reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  placeholder="Escreva uma observação para a equipe..."
                  className={`${FORM_CONTROL_CLASS} min-h-32 resize-y`}
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={busy || !reply.trim()} onClick={submitReply} className={PRIMARY_BUTTON_CLASS}>Enviar comentário</button>
                <button type="button" disabled={busy} onClick={() => setCancelOpen(true)} className={DANGER_BUTTON_CLASS} data-testid="access-request-cancel-open">Cancelar solicitação</button>
              </div>
            </div>
          </section>
        )}

        <button onClick={() => router.push("/login")} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#011848] bg-[#011848] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(1,24,72,0.16)] transition hover:-translate-y-0.5 hover:bg-[#142b63] focus:outline-none focus:ring-4 focus:ring-[#011848]/15">Voltar ao login</button>
        </div>
      </section>

      {(error || feedback) && (
        <FloatingNotice
          type={error ? "error" : "success"}
          message={error ?? feedback ?? ""}
          onClose={() => {
            setError(null);
            setFeedback(null);
          }}
        />
      )}

      {cancelOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-[#011848]/70 px-4 py-6 backdrop-blur-md ${requestStyles.modalOverlay}`}
          onClick={() => {
            if (!busy) setCancelOpen(false);
          }}
          role="presentation"
          data-testid="access-request-cancel-modal-overlay"
        >
          <section
            className={`w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_28px_80px_rgba(1,24,72,0.4)] ${requestStyles.modalPanel}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-request-cancel-title"
            aria-describedby="access-request-cancel-description"
            onClick={(event) => event.stopPropagation()}
            data-testid="access-request-cancel-modal"
          >
            <div className="h-2 bg-linear-to-r from-[#011848] via-[#142b63] to-[#ef0001]" />
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#011848] to-[#ef0001] shadow-lg">
                  <div className="relative h-8 w-8">
                    <Image
                      src="/images/tc.png"
                      alt=""
                      fill
                      sizes="32px"
                      className="animate-spin-slower pointer-events-none select-none object-contain object-center motion-reduce:animate-none"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ef0001]">Confirmação</p>
                  <h2 id="access-request-cancel-title" className="mt-1 text-xl font-black text-[#011848]">
                    Cancelar solicitação?
                  </h2>
                  <p id="access-request-cancel-description" className="mt-2 text-sm font-medium leading-6 text-[#64748b]">
                    Esta ação encerra o acompanhamento desta solicitação. Confirme somente se não deseja mais continuar com o pedido.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">
                A equipe não continuará a análise depois do cancelamento.
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  autoFocus
                  disabled={busy}
                  onClick={() => setCancelOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#011848]/15 bg-[#f8fafc] px-5 py-3 text-sm font-black text-[#011848] transition hover:border-[#011848]/30 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#011848]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="access-request-cancel-keep"
                >
                  Manter solicitação
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelRequest}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ef0001] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(239,0,1,0.2)] transition hover:-translate-y-0.5 hover:bg-[#d50000] focus:outline-none focus:ring-4 focus:ring-[#ef0001]/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  data-testid="access-request-cancel-confirm"
                >
                  {busy ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function AccessRequestStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#f4f6fb]" />}>
      <StatusContent />
    </Suspense>
  );
}
