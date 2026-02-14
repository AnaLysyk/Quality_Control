"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import loginStyles from "../LoginClient.module.css";
import styles from "./AccessRequestClient.module.css";

const ACCESS_OPTIONS = [
  {
    value: "user",
    label: "Usuário da empresa",
    description:
      "Acesso regular vinculado a uma empresa/cliente (leitura de dashboards e permissões operacionais).",
  },
  {
    value: "company",
    label: "Admin da empresa",
    description: "Permite gerenciar usuários, releases e permissões da própria empresa.",
  },
  {
    value: "admin",
    label: "Admin do sistema",
    description: "Acesso completo ao painel (apenas para equipes internas).",
  },
];

type LookupItem = {
  id: string;
  status: string;
  createdAt: string;
  email: string;
  name: string;
  jobRole?: string | null;
  company?: string | null;
  clientId?: string | null;
  accessType?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
};

type AccessRequestComment = {
  id: string;
  authorRole: "admin" | "requester";
  authorName: string;
  body: string;
  createdAt: string;
};

export default function AccessRequestClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [clientId, setClientId] = useState("");
  const [role, setRole] = useState("");
  const [accessType, setAccessType] = useState<"user" | "company" | "admin">("user");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [lookupName, setLookupName] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupItem, setLookupItem] = useState<LookupItem | null>(null);
  const [lookupComments, setLookupComments] = useState<AccessRequestComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const lookupNameRef = useRef<HTMLInputElement>(null);
  const requestNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLookupOpen && !isRequestOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLookupOpen(false);
        setIsRequestOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLookupOpen, isRequestOpen]);

  useEffect(() => {
    if (!isLookupOpen) return;
    const timer = window.setTimeout(() => lookupNameRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isLookupOpen]);

  useEffect(() => {
    if (!isRequestOpen) return;
    const timer = window.setTimeout(() => requestNameRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isRequestOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedRole = role.trim();

    if (!normalizedName || !normalizedEmail || !normalizedRole) {
      setError("Informe nome, e-mail e cargo.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("E-mail inválido.");
      return;
    }

    const normalizedCompany = company.trim();
    const normalizedClientId = clientId.trim();

    if (accessType !== "admin" && !normalizedCompany && !normalizedClientId) {
      setError("Informe o nome da empresa ou o ID do cliente para esse tipo de acesso.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/support/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          company: normalizedCompany,
          client_id: normalizedClientId,
          role: normalizedRole,
          access_type: accessType,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Erro ao registrar solicitação.");
      }

      setSuccess("Solicitação enviada. Em breve você receberá um retorno por e-mail.");
      setName("");
      setEmail("");
      setCompany("");
      setClientId("");
      setRole("");
      setNotes("");
      setAccessType("user");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === "closed") return "Aprovada";
    if (status === "rejected") return "Rejeitada";
    if (status === "in_progress") return "Em análise";
    return "Aberta";
  };

  const statusTone = (status: string) => {
    if (status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
    if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-100 text-slate-700";
  };

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError(null);
    setLookupItem(null);
    setLookupComments([]);
    setCommentDraft("");

    const normalizedEmail = lookupEmail.trim().toLowerCase();
    const normalizedName = lookupName.trim();

    if (!normalizedName || !normalizedEmail) {
      setLookupError("Informe nome e e-mail para consultar.");
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(
        `/api/support/access-request/lookup?name=${encodeURIComponent(normalizedName)}&email=${encodeURIComponent(
          normalizedEmail,
        )}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as {
        item?: LookupItem;
        comments?: AccessRequestComment[];
        error?: string;
      };
      if (!res.ok) {
        setLookupError(json?.error || "Solicitação não encontrada.");
        return;
      }
      setLookupItem(json.item ?? null);
      setLookupComments(Array.isArray(json.comments) ? json.comments : []);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao consultar solicitação.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!lookupItem) return;
    const body = commentDraft.trim();
    if (!body) return;

    setCommentSubmitting(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/support/access-request/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: lookupItem.id,
          name: lookupName.trim(),
          email: lookupEmail.trim().toLowerCase(),
          comment: body,
        }),
      });
      const json = (await res.json().catch(() => null)) as { item?: AccessRequestComment; error?: string };
      if (!res.ok) {
        setLookupError(json?.error || "Falha ao enviar comentário.");
        return;
      }
      if (json.item) {
        setLookupComments((prev) => [...prev, json.item as AccessRequestComment]);
      }
      setCommentDraft("");
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao enviar comentário.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const currentOption = ACCESS_OPTIONS.find((option) => option.value === accessType);
  const adminNote = lookupItem?.adminNotes?.trim() || "";
  const showAdminNote =
    Boolean(adminNote) &&
    !lookupComments.some(
      (comment) => comment.authorRole === "admin" && comment.body.trim() === adminNote,
    );

  const inputBase =
    "form-control-user w-full rounded-xl border border-[--tc-border] bg-[--tc-surface] px-4 py-3 text-sm text-[--tc-text] placeholder:text-[--tc-text-muted] focus:ring-2 focus:ring-[--tc-accent]/40 focus:border-[--tc-accent]/60 transition-all duration-200";

  const textareaBase =
    "form-control-user w-full rounded-xl border border-[--tc-border] bg-[--tc-surface] px-4 py-3 text-sm text-[--tc-text] placeholder:text-[--tc-text-muted] focus:ring-2 focus:ring-[--tc-accent]/40 focus:border-[--tc-accent]/60 transition-all duration-200";

  const labelClass = "space-y-2 text-sm font-semibold text-[--tc-text]";

  return (
    <div
      className={
        `${loginStyles.loginContainer} ${loginStyles.loginFixedTheme} min-h-svh flex items-start sm:items-center ` +
        "justify-start sm:justify-center bg-linear-to-br from-[--tc-surface] via-[--tc-surface-variant] to-[--tc-accent] " +
        "relative overflow-x-hidden overflow-y-auto px-4 py-10 sm:px-6 md:px-10"
      }
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[--tc-surface] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[--tc-accent] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[--tc-accent] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[--tc-surface] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        <div className="absolute top-10 left-44 w-16 h-16 bg-[--tc-accent] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[--tc-surface] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[--tc-accent] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[--tc-surface] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="max-w-3xl w-full space-y-8 relative z-10">
        <div className={`text-center ${styles.introBase} ${styles.introDelay1}`}>
          <h2 className="mt-5 text-3xl sm:text-4xl font-bold text-[--tc-text] mb-2 leading-tight drop-shadow-sm">
            Solicitações de acesso
          </h2>
          <p className="text-[--tc-text-muted] font-medium">
            Consulte uma solicitação existente ou envie um novo pedido de acesso ao painel.
          </p>
        </div>

        <div className="space-y-4">
          <div
            className={`bg-white/90 backdrop-blur-sm border border-[#011848]/10 shadow-2xl rounded-2xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
              styles.introBase
            } ${styles.introDelay2}`}
          >
            <div>
              <h3 className="text-lg font-semibold text-[--tc-text]">Consultar solicitação</h3>
              <p className="text-sm text-[--tc-text-muted]">
                Acompanhe o status e os comentários da sua solicitação em tempo real.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLookupOpen(true);
                setIsRequestOpen(false);
                setLookupError(null);
              }}
              title="Consultar agora"
              className="inline-flex items-center justify-center rounded-xl border border-[#011848]/15 bg-white px-5 py-2 text-sm font-semibold text-[#011848] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#011848]/5 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/50"
            >
              Consultar agora
            </button>
          </div>

          <div
            className={`bg-white/90 backdrop-blur-sm border border-[#011848]/10 shadow-2xl rounded-2xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
              styles.introBase
            } ${styles.introDelay3}`}
          >
            <div>
              <h3 className="text-lg font-semibold text-[--tc-text]">Solicitar acesso</h3>
              <p className="text-sm text-[--tc-text-muted]">
                Envie um novo pedido de acesso e nossa equipe vai orientar o próximo passo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRequestOpen(true);
                setIsLookupOpen(false);
                setError(null);
                setSuccess(null);
              }}
              title="Solicitar acesso"
              className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/60"
            >
              Solicitar acesso
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-[--tc-text-muted]">
          <Link href="/login" className="font-semibold text-[--tc-text] hover:text-[--tc-accent]">
            Voltar ao login
          </Link>
        </div>
      </div>

      {isRequestOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-950/50 backdrop-blur-sm ${
            styles.modalOverlay
          }`}
          onClick={() => setIsRequestOpen(false)}
          role="presentation"
        >
          <div
            className={`w-full max-w-3xl rounded-2xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl p-6 sm:p-8 ${
              styles.modalPanel
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="request-title" className="text-xl font-semibold text-[--tc-text]">
                  Solicitar acesso
                </h3>
                <p className="text-sm text-[--tc-text-muted]">
                  Preencha os dados abaixo para abrir uma nova solicitação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestOpen(false)}
                className="rounded-full border border-[--tc-border] bg-[--tc-surface] p-2 text-[--tc-text-muted] transition hover:text-[--tc-accent]"
                aria-label="Fechar modal"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-[--tc-error] bg-[--tc-error-bg] px-4 py-3 text-sm text-[--tc-error-text]">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-[--tc-success] bg-[--tc-success-bg] px-4 py-3 text-sm text-[--tc-success-text]">
                  {success}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Nome completo
                  <input
                    ref={requestNameRef}
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className={inputBase}
                    placeholder="Ana Souza"
                  />
                </label>
                <label className={labelClass}>
                  E-mail profissional
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className={inputBase}
                    placeholder="voce@empresa.com"
                  />
                </label>
              </div>

              <label className={labelClass}>
                Cargo ou função
                <input
                  type="text"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  required
                  className={inputBase}
                  placeholder="Analista de QA"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Empresa (ou nome do cliente)
                  <input
                    type="text"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className={inputBase}
                    placeholder="Testing Company"
                  />
                </label>
                <label className={labelClass}>
                  ID do cliente (opcional)
                  <input
                    type="text"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className={inputBase}
                    placeholder="client-123"
                  />
                </label>
              </div>

                <div className="space-y-2 text-sm font-semibold text-[--tc-text]">
                  <div className="flex items-center justify-between">
                    <span>Tipo de acesso</span>
                    <span className="text-xs font-medium text-[--tc-text-muted]">Escolha conforme seu papel</span>
                  </div>
                <label className="sr-only" htmlFor="access-type-select">
                  Tipo de acesso
                </label>
                <select
                  id="access-type-select"
                  aria-label="Tipo de acesso"
                  value={accessType}
                  onChange={(event) => setAccessType(event.target.value as "user" | "company" | "admin")}
                  className={inputBase}
                >
                  {ACCESS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {currentOption && (
                  <p className="text-xs font-medium text-[--tc-text-muted]">{currentOption.description}</p>
                )}
              </div>

              <label className={labelClass}>
                Observações (opcional)
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className={textareaBase}
                  placeholder="Preciso criar releases e revisar dashboards de aceitação."
                />
              </label>

              <button
                type="submit"
                title="Enviar solicitação"
                disabled={loading}
                className="w-full flex items-center justify-center rounded-xl bg-linear-to-r from-[--tc-surface] to-[--tc-accent] px-4 py-3 text-sm font-semibold text-white transition hover:from-[--tc-surface]/90 hover:to-[--tc-accent]/90 focus:outline-none focus:ring-2 focus:ring-[--tc-accent]/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Enviando..." : "Enviar solicitação"}
              </button>
            </form>
          </div>
        </div>
      )}

      {isLookupOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-950/50 backdrop-blur-sm ${
            styles.modalOverlay
          }`}
          onClick={() => setIsLookupOpen(false)}
          role="presentation"
        >
          <div
            className={`w-full max-w-2xl rounded-2xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl p-6 sm:p-8 ${
              styles.modalPanel
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lookup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="lookup-title" className="text-xl font-semibold text-[--tc-text]">
                  Consultar solicitação
                </h3>
                <p className="text-sm text-[--tc-text-muted]">
                  Informe nome e e-mail para ver o andamento e os comentários.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLookupOpen(false)}
                className="rounded-full border border-[--tc-border] bg-[--tc-surface] p-2 text-[--tc-text-muted] transition hover:text-[--tc-accent]"
                aria-label="Fechar modal"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleLookup}>
              {lookupError && (
                <div className="rounded-xl border border-[--tc-error] bg-[--tc-error-bg] px-4 py-3 text-sm text-[--tc-error-text]">
                  {lookupError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Nome completo
                  <input
                    ref={lookupNameRef}
                    type="text"
                    value={lookupName}
                    onChange={(event) => setLookupName(event.target.value)}
                    required
                    className={inputBase}
                    placeholder="Ana Souza"
                  />
                </label>
                <label className={labelClass}>
                  E-mail
                  <input
                    type="email"
                    value={lookupEmail}
                    onChange={(event) => setLookupEmail(event.target.value)}
                    required
                    className={inputBase}
                    placeholder="voce@empresa.com"
                  />
                </label>
              </div>

              <button
                type="submit"
                title="Consultar solicitação"
                disabled={lookupLoading}
                className="w-full flex items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-4 py-3 text-sm font-semibold text-white transition hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {lookupLoading ? "Consultando..." : "Consultar solicitação"}
              </button>
            </form>

            {lookupItem && (
              <div className="mt-6 rounded-2xl border border-[--tc-border] bg-[--tc-surface-variant] p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[--tc-text]">Solicitação encontrada</p>
                    <p className="text-xs text-[--tc-text-muted]">
                      Criada em {new Date(lookupItem.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${statusTone(lookupItem.status)}`}
                  >
                    {statusLabel(lookupItem.status)}
                  </span>
                </div>

                {showAdminNote && (
                  <div className="rounded-lg border bg-[--tc-surface] px-3 py-2 text-sm text-[--tc-text]">
                    <strong>Comentário do admin:</strong> {adminNote}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#011848]">Comentários</p>
                  <div className="comments-chat">
                    <div className="comments-chat-list" aria-live="polite">
                      {lookupComments.length === 0 ? (
                        <p className="comments-chat-empty">Nenhum comentário ainda.</p>
                      ) : (
                        lookupComments.map((comment) => {
                          const mine = comment.authorRole === "requester";
                          return (
                            <div
                              key={comment.id}
                              className={`comments-chat-message ${mine ? "mine" : "other"}`}
                            >
                              <div className="comments-chat-author">
                                {comment.authorRole === "admin" ? "Admin" : "Solicitante"}: {comment.authorName}
                              </div>
                              <div className="comments-chat-bubble whitespace-pre-wrap">{comment.body}</div>
                              <div className="comments-chat-meta">
                                {new Date(comment.createdAt).toLocaleString("pt-BR")}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="comments-chat-input">
                      <textarea
                        className={textareaBase}
                        rows={3}
                        placeholder="Adicionar comentário"
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                      />
                      <div className="comments-chat-actions">
                        <button
                          type="button"
                          onClick={handleSubmitComment}
                          disabled={commentSubmitting || !commentDraft.trim()}
                          title="Enviar comentário"
                          className="rounded-xl border border-[#011848]/15 bg-white px-4 py-2 text-xs font-semibold text-[#011848] transition hover:bg-[#011848]/5 disabled:opacity-60"
                        >
                          {commentSubmitting ? "Enviando..." : "Enviar comentário"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
