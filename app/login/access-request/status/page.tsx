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
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  under_review: {
    label: "Em análise",
    text: "Sua correção foi recebida e voltou para análise. As atualizações serão enviadas por e-mail.",
    tone: "border-blue-200 bg-blue-50 text-blue-800",
  },
  needs_more_info: {
    label: "Ajuste necessário",
    text: "Corrija somente os campos destacados e reenvie para análise.",
    tone: "border-red-200 bg-red-50 text-red-800",
  },
  approved: {
    label: "Aprovado",
    text: "Sua solicitação foi aprovada. As instruções de acesso foram enviadas por e-mail.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  rejected: {
    label: "Rejeitado",
    text: "Sua solicitação foi rejeitada. Consulte o motivo informado pela equipe.",
    tone: "border-red-300 bg-red-50 text-red-800",
  },
  cancelled: {
    label: "Cancelado",
    text: "Esta solicitação foi cancelada.",
    tone: "border-slate-200 bg-slate-100 text-slate-700",
  },
  expired: {
    label: "Expirado",
    text: "Esta solicitação expirou.",
    tone: "border-slate-200 bg-slate-100 text-slate-700",
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

function Info({ label, value, testId }: { label: string; value?: string; testId?: string }) {
  return (
    <div className="rounded-2xl border border-[#011848]/10 bg-white p-4 shadow-[0_5px_16px_rgba(1,24,72,0.04)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748b]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[#011848]" data-testid={testId}>
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
        <p className="relative z-10 rounded-2xl bg-white px-5 py-3 font-semibold shadow-xl">Carregando solicitação...</p>
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

        <section className={`mt-7 rounded-2xl border p-5 ${status.tone}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]" data-testid="access-request-status-label">{status.label}</p>
              <p className="mt-2 text-sm font-semibold" data-testid="access-request-status-message">{status.text}</p>
            </div>
            <span className="rounded-full border border-current px-4 py-2 text-xs font-black" data-testid="access-request-status-badge">{status.label}</span>
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

        {(error || feedback) && <p className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error ?? feedback}</p>}

        <button onClick={() => router.push("/login")} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#011848] bg-[#011848] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(1,24,72,0.16)] transition hover:-translate-y-0.5 hover:bg-[#142b63] focus:outline-none focus:ring-4 focus:ring-[#011848]/15">Voltar ao login</button>
        </div>
      </section>

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
