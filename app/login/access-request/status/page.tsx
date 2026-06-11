"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../../LoginClient.module.css";

type RequestPublic = {
  id: string;
  status: string;
  requestType: string;
  requestedRole?: string;
  requestedCompanySlug?: string;
  requesterName?: string;
  requesterEmail: string;
  reason?: string;
  reviewComment?: string;
  adjustmentFields: string[];
  priority: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, { label: string; badge: string; text: string }> = {
  pending: {
    label: "Aguardando análise",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    text: "Sua solicitação foi recebida com sucesso e está aguardando análise.",
  },
  under_review: {
    label: "Em análise",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    text: "Sua solicitação está em análise pela equipe responsável.",
  },
  needs_more_info: {
    label: "Ajuste necessário",
    badge: "border-red-200 bg-red-50 text-red-700",
    text: "A equipe solicitou ajustes. Corrija os campos destacados em vermelho.",
  },
  approved: {
    label: "Aprovado",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "Sua solicitação foi aprovada. Verifique seu e-mail para acessar o sistema.",
  },
  rejected: {
    label: "Rejeitado",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    text: "Sua solicitação foi rejeitada. Confira o comentário da equipe.",
  },
  cancelled: {
    label: "Cancelado",
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    text: "Esta solicitação foi cancelada.",
  },
  expired: {
    label: "Expirado",
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    text: "Esta solicitação expirou.",
  },
};

const FIELD_LABELS: Record<string, string> = {
  profileType: "Perfil",
  company: "Empresa",
  fullName: "Nome completo",
  username: "Usuário/login",
  email: "E-mail",
  phone: "Telefone",
  jobRole: "Cargo",
  title: "Título",
  description: "Descrição",
  notes: "Observações",
  password: "Senha",
  companyName: "Razão social",
  companyTaxId: "CNPJ",
  companyZip: "CEP",
  companyAddress: "Endereço",
  companyPhone: "Telefone da empresa",
  companyWebsite: "Website",
  companyLinkedin: "LinkedIn",
  companyDescription: "Descrição da empresa",
  companyNotes: "Observações da empresa",
};

function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function profileLabel(item: RequestPublic) {
  if (item.requestType === "company_creation" || item.requestedRole === "empresa") {
    return "Empresa";
  }

  if (item.requestedRole === "company_user") return "Usuário da empresa";
  if (item.requestedRole === "testing_company_user") return "Usuário TC";
  if (item.requestedRole === "leader_tc") return "Líder TC";
  if (item.requestedRole === "technical_support") return "Suporte Técnico";

  return item.requestedRole ?? item.requestType;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? {
    label: status,
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    text: "",
  };

  return (
    <span className={`rounded-full border px-4 py-2 text-xs font-bold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

function Logo() {
  return (
    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-r from-[#011848] to-[#ef0001] shadow-lg sm:h-24 sm:w-24">
      <div className="relative h-12 w-12 sm:h-16 sm:w-16">
        <Image
          src="/images/tc.png"
          alt="Logo Quality Control"
          fill
          sizes="(min-width: 640px) 64px, 48px"
          priority
          className="animate-spin-slower select-none object-contain object-center pointer-events-none"
        />
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  if (!value) return null;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-red-300 bg-red-50 shadow-sm ring-2 ring-red-100"
          : "border-[#011848]/10 bg-white/90"
      }`}
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
          highlight ? "text-red-600" : "text-[#64748b]"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[#011848]">{value}</p>
    </div>
  );
}

function AccessRequestStatusContent() {
  const params = useSearchParams();
  const router = useRouter();
  const key = params.get("key") ?? "";

  const [item, setItem] = useState<RequestPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!key) {
      setError("Chave de acesso não informada.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/access-requests/by-key/${encodeURIComponent(key)}`, {
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as {
        item?: RequestPublic;
        message?: string;
      } | null;

      if (!res.ok || !data?.item) {
        throw new Error(data?.message ?? "Solicitação não encontrada.");
      }

      setItem(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [key]);

  const requestedFields = useMemo(
    () => new Set(item?.adjustmentFields ?? []),
    [item?.adjustmentFields],
  );

  const statusInfo = item ? STATUS_LABELS[item.status] ?? STATUS_LABELS.pending : STATUS_LABELS.pending;
  const needsAdjustment = item?.status === "needs_more_info";
  const canInteract = Boolean(item && !["approved", "rejected", "cancelled", "expired"].includes(item.status));

  const submitReply = async () => {
    if (!item || !reply.trim()) return;

    setBusy(true);
    setFeedback(null);
    setError(null);

    try {
      const res = await fetch("/api/support/access-request/comments", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: item.id,
          name: item.requesterName ?? "",
          email: item.requesterEmail,
          comment: reply.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Não foi possível enviar a resposta.");
      }

      setReply("");
      setFeedback("Resposta enviada para a equipe.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar resposta.");
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!item) return;

    const confirmed = window.confirm("Deseja cancelar esta solicitação?");
    if (!confirmed) return;

    setBusy(true);
    setFeedback(null);
    setError(null);

    try {
      const res = await fetch(`/api/access-requests/by-key/${encodeURIComponent(key)}/cancel`, {
        method: "POST",
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        throw new Error(data?.message ?? "Não foi possível cancelar a solicitação.");
      }

      setFeedback("Solicitação cancelada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar solicitação.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main
        className={
          styles.loginContainer +
          " " +
          styles.loginFixedTheme +
          " min-h-svh flex items-center justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] px-4 py-10"
        }
      >
        <p className="rounded-2xl bg-white/90 px-5 py-3 text-sm font-semibold text-[#011848] shadow-xl">
          Carregando solicitação...
        </p>
      </main>
    );
  }

  if (error && !item) {
    return (
      <main
        className={
          styles.loginContainer +
          " " +
          styles.loginFixedTheme +
          " min-h-svh flex items-center justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] px-4 py-10"
        }
      >
        <section className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-8 text-center shadow-2xl backdrop-blur-sm">
          <Logo />
          <p className="font-semibold text-red-600">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 w-full rounded-xl bg-[#011848] px-5 py-3 text-sm font-bold text-white"
          >
            Voltar ao login
          </button>
        </section>
      </main>
    );
  }

  if (!item) return null;

  return (
    <main
      className={
        styles.loginContainer +
        " " +
        styles.loginFixedTheme +
        " min-h-svh flex items-start justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] relative isolate overflow-x-hidden overflow-y-auto px-4 py-10 sm:px-6 md:px-10"
      }
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
      </div>

      <section className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/60 bg-white/90 p-5 shadow-2xl backdrop-blur-sm sm:p-8">
        <header className="text-center">
          <Logo />

          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.45em] text-[#ef0001]">
            Quality Control
          </p>

          <h1 className="mt-3 text-2xl font-black text-[#011848]">
            Acompanhamento da solicitação
          </h1>

          <p className="mt-2 text-sm text-[#475569]">
            Consulte aqui o andamento do seu pedido de acesso.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-[#011848]/10 bg-white/90 p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ef0001]">
            {needsAdjustment ? "Dados solicitados para alteração" : "Dados da solicitação"}
          </p>

          <h2 className="mt-1 text-lg font-black text-[#011848]">
            {needsAdjustment ? "Corrija os campos destacados em vermelho" : "Resumo do pedido enviado"}
          </h2>

          {needsAdjustment && item.adjustmentFields.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.adjustmentFields.map((field) => (
                <span
                  key={field}
                  className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                >
                  {fieldLabel(field)}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Nome" value={item.requesterName} highlight={requestedFields.has("fullName")} />
            <InfoCard label="E-mail informado" value={item.requesterEmail} highlight={requestedFields.has("email")} />
            <InfoCard label="Tipo de solicitante" value={profileLabel(item)} highlight={requestedFields.has("profileType")} />
            <InfoCard label="Empresa" value={item.requestedCompanySlug} highlight={requestedFields.has("company")} />
            <InfoCard label="Descrição" value={item.reason} highlight={requestedFields.has("description")} />
            <InfoCard label="Solicitação criada em" value={new Date(item.createdAt).toLocaleDateString("pt-BR")} />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ef0001]">
                Situação atual
              </p>
              <p className="mt-2 text-sm font-semibold text-[#011848]">{statusInfo.text}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </section>

        {item.reviewComment && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-700">
              Comentário da equipe
            </p>
            <p className="mt-3 text-sm font-semibold text-[#011848]">{item.reviewComment}</p>
          </section>
        )}

        {canInteract && (
          <section className="mt-5 rounded-2xl border border-[#011848]/10 bg-white/90 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#011848]">
              Responder equipe
            </p>

            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={4}
              placeholder="Escreva uma resposta ou observação para a equipe..."
              className="mt-3 w-full rounded-xl border border-[#011848]/20 bg-white px-4 py-3 text-sm text-[#011848] outline-none focus:border-[#ef0001] focus:ring-2 focus:ring-[#ef0001]/20"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {needsAdjustment && (
                <a
                  href={`/login/solicitar-acesso?key=${encodeURIComponent(key)}`}
                  className="rounded-xl bg-[#ef0001] px-5 py-3 text-center text-sm font-black text-white shadow-lg shadow-red-200"
                >
                  Corrigir campos
                </a>
              )}

              <button
                type="button"
                onClick={submitReply}
                disabled={busy || !reply.trim()}
                className="rounded-xl bg-[#011848] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar resposta
              </button>

              <button
                type="button"
                onClick={cancelRequest}
                disabled={busy}
                className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar solicitação
              </button>
            </div>
          </section>
        )}

        {(feedback || error) && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm font-semibold ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? feedback}
          </div>
        )}

        <button
          onClick={() => router.push("/login")}
          className="mt-6 w-full rounded-xl bg-[#011848] px-5 py-3 text-sm font-black text-white"
        >
          Voltar ao login
        </button>
      </section>
    </main>
  );
}

export default function AccessRequestStatusPage() {
  return (
    <Suspense
      fallback={
        <main
          className={
            styles.loginContainer +
            " " +
            styles.loginFixedTheme +
            " min-h-svh flex items-center justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] px-4 py-10"
          }
        >
          <p className="rounded-2xl bg-white/90 px-5 py-3 text-sm font-semibold text-[#011848] shadow-xl">
            Carregando...
          </p>
        </main>
      }
    >
      <AccessRequestStatusContent />
    </Suspense>
  );
}