"use client";

import { useMemo, useState, useCallback } from "react";
import { useSWRRequests } from "./useSWRRequests";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumb";

type RequestRecord = {
  id: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE" | "PASSWORD_RESET" | "PROFILE_DELETION";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, unknown>;
  createdAt: string;
  reviewNote?: string;
};

const REQUEST_TYPE_LABEL: Record<RequestRecord["type"], string> = {
  EMAIL_CHANGE: "Troca de e-mail",
  COMPANY_CHANGE: "Troca de empresa",
  PASSWORD_RESET: "Reset de senha",
  PROFILE_DELETION: "Exclusao de perfil",
};

const STATUS_TONE: Record<RequestRecord["status"], "warning" | "positive" | "danger"> = {
  PENDING: "warning",
  APPROVED: "positive",
  REJECTED: "danger",
};

const STATUS_LABEL: Record<RequestRecord["status"], string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
};

export default function RequestsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    const nextMessage = "Sessao expirada. Faca login novamente.";
    setMessage(nextMessage);
    toast.error(nextMessage);
    router.push("/login");
  }, [router]);

  const { requests, loading, error, refetch, scope } = useSWRRequests();

  const summary = useMemo(() => {
    const pending = requests.filter((item: RequestRecord) => item.status === "PENDING").length;
    const approved = requests.filter((item: RequestRecord) => item.status === "APPROVED").length;
    const rejected = requests.filter((item: RequestRecord) => item.status === "REJECTED").length;
    return { pending, approved, rejected };
  }, [requests]);

  async function submitEmail() {
    setMessage(null);
    const response = await fetch("/api/requests/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: email }),
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nextMessage = payload.message || "Erro ao enviar solicitacao.";
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setEmail("");
    setMessage("Solicitacao de e-mail enviada.");
    toast.success("Solicitacao de e-mail enviada.");
    void refetch();
  }

  async function submitCompany() {
    setMessage(null);
    const response = await fetch("/api/requests/company-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCompanyName: company }),
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nextMessage = payload.message || "Erro ao enviar solicitacao.";
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setCompany("");
    setMessage("Solicitacao de empresa enviada.");
    toast.success("Solicitacao de empresa enviada.");
    void refetch();
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className="tc-page-shell py-4 sm:py-6">
        <Breadcrumb items={[{ label: "Conta", href: "/settings/profile" }, { label: "Solicitacoes" }]} />

        <section className="tc-hero-panel">
          <div className="tc-hero-grid">
            <div className="space-y-5">
              <div className="tc-hero-copy">
                <p className="tc-hero-kicker">{scope === "all" ? "Central de solicitacoes" : "Solicitacoes do usuario"}</p>
                <h1 className="tc-hero-title">Ajustes de conta</h1>
                <p className="tc-hero-description">
                  {scope === "all"
                    ? "Suporte tecnico acompanha toda a fila e os demais perfis continuam vendo apenas os proprios registros."
                    : "Abra pedidos de troca de e-mail ou empresa e acompanhe o retorno no mesmo fluxo."}
                </p>
              </div>
            </div>

            <div className="tc-hero-stat-grid">
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">Solicitacoes</div>
                <div className="tc-hero-stat-value">{requests.length}</div>
                <div className="tc-hero-stat-note">{scope === "all" ? "Total da fila visivel." : "Total de pedidos registrados."}</div>
              </div>
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">Pendentes</div>
                <div className="tc-hero-stat-value">{summary.pending}</div>
                <div className="tc-hero-stat-note">Aguardando avaliacao.</div>
              </div>
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">Aprovadas</div>
                <div className="tc-hero-stat-value">{summary.approved}</div>
                <div className="tc-hero-stat-note">Pedidos concluidos.</div>
              </div>
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">Rejeitadas</div>
                <div className="tc-hero-stat-value">{summary.rejected}</div>
                <div className="tc-hero-stat-note">Solicitacoes que precisaram de ajuste.</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <p className="tc-panel-kicker">E-mail</p>
                <h2 className="tc-panel-title">Solicitar troca de e-mail</h2>
                <p className="tc-panel-description">Envie um novo e-mail para revisao administrativa.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary,#0b1a3c)">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Novo e-mail</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="novo@email.com"
                  className="form-control-user w-full rounded-xl px-4 py-3 text-sm"
                />
              </label>
              <button type="button" onClick={submitEmail} className="tc-button-primary" disabled={!email.trim()}>
                Enviar solicitacao
              </button>
            </div>
          </section>

          <section className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <p className="tc-panel-kicker">Empresa</p>
                <h2 className="tc-panel-title">Solicitar troca de empresa</h2>
                <p className="tc-panel-description">Peça a alteracao do contexto principal de empresa do usuario.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary,#0b1a3c)">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">Nova empresa</span>
                <input
                  type="text"
                  autoComplete="organization"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Nome da empresa"
                  className="form-control-user w-full rounded-xl px-4 py-3 text-sm"
                />
              </label>
              <button type="button" onClick={submitCompany} className="tc-button-primary" disabled={!company.trim()}>
                Enviar solicitacao
              </button>
            </div>
          </section>
        </div>

        {message ? (
          <div className="rounded-[18px] border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm font-medium text-(--tc-text-primary,#0b1a3c)">
            {message}
          </div>
        ) : null}

        <section className="tc-panel">
          <div className="tc-panel-header">
            <div>
              <p className="tc-panel-kicker">Historico</p>
              <h2 className="tc-panel-title">Status das solicitacoes</h2>
              <p className="tc-panel-description">Leitura direta do que esta pendente, aprovado ou rejeitado.</p>
            </div>
            {loading ? <span className="text-sm font-medium text-(--tc-text-muted,#6b7280)">Carregando...</span> : null}
          </div>

          <div className="mt-5 space-y-3">
            {error ? (
              <div className="tc-empty-state">Nao foi possivel carregar o historico agora.</div>
            ) : requests.length === 0 ? (
              <div className="tc-empty-state">Nenhuma solicitacao registrada ate o momento.</div>
            ) : (
              requests.map((request) => (
                <article key={request.id} className="tc-panel-muted">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-(--tc-text-primary,#0b1a3c)">{REQUEST_TYPE_LABEL[request.type]}</p>
                      <p className="mt-1 text-sm text-(--tc-text-muted,#6b7280)">Criada em {new Date(request.createdAt).toLocaleString("pt-BR")}</p>
                      {request.reviewNote ? (
                        <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">Observacao: {request.reviewNote}</p>
                      ) : null}
                    </div>

                    <span className="tc-status-pill" data-tone={STATUS_TONE[request.status]}>
                      <span className="tc-status-dot" />
                      {STATUS_LABEL[request.status]}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
