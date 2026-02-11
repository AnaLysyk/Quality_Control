"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const ACCESS_OPTIONS = [
  { value: "user", label: "Usuário da empresa", description: "Acesso regular vinculado a uma empresa/ciente (leitura de dashboards/permissão de execução)." },
  { value: "company", label: "Admin da empresa", description: "Permite gerenciar usuários e releases da própria empresa." },
  { value: "admin", label: "Admin do sistema", description: "Acesso completo ao painel (apenas para equipes internas)." },
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
    if (status === "in_progress") return "Em analise";
    return "Aberta";
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
      const json = (await res.json().catch(() => null)) as { item?: LookupItem; comments?: AccessRequestComment[]; error?: string };
      if (!res.ok) {
        setLookupError(json?.error || "Solicitacao nao encontrada.");
        return;
      }
      setLookupItem(json.item ?? null);
      setLookupComments(Array.isArray(json.comments) ? json.comments : []);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao consultar solicitacao.");
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
        setLookupError(json?.error || "Falha ao enviar comentario.");
        return;
      }
      if (json.item) {
        setLookupComments((prev) => [...prev, json.item as AccessRequestComment]);
      }
      setCommentDraft("");
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao enviar comentario.");
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

  return (
    <div className="min-h-[100svh] flex items-start sm:items-center justify-start sm:justify-center bg-gradient-to-br from-[#f4f6fb] via-[#eff0f6] to-[#ffffff] py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto">
      <div className="max-w-xl w-full space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#0b1a3c] text-center">
            Solicitar acesso
          </h2>
          <p className="mt-2 text-center text-sm text-[#475569]">
            Precisando de acesso a uma empresa ou ao admin? Preencha o formulário e nossa equipe irá aprovar ou orientar o próximo passo.
          </p>
        </div>

        <form className="bg-white shadow-xl rounded-2xl px-8 py-10 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              Nome completo
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="Ana Souza"
              />
            </label>
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              E-mail profissional
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="voce@empresa.com"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm text-[#0b1a3c]">
            Cargo ou função
            <input
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              required
              className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
              placeholder="Analista de QA"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              Empresa (ou nome do cliente)
              <input
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="Testing Company"
              />
            </label>
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              ID do cliente (opcional)
              <input
                type="text"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="client-123"
              />
            </label>
          </div>

          <div className="space-y-1 text-sm text-[#0b1a3c]">
            <div className="flex items-center justify-between">
              <span>Tipo de acesso</span>
              <span className="text-xs text-[#6b7280]">Escolha conforme seu papel</span>
            </div>
            <select
              value={accessType}
              onChange={(event) => setAccessType(event.target.value as "user" | "company" | "admin")}
              className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
            >
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {currentOption && (
              <p className="text-xs text-[#475569]">{currentOption.description}</p>
            )}
          </div>

          <label className="space-y-1 text-sm text-[#0b1a3c]">
            Observações (opcional)
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
              placeholder="Preciso criar releases e revisar dashboards de aceitação."
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center rounded-lg bg-[#011848] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ef0001] hover:text-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar solicitação"}
          </button>

          <div className="text-center text-sm text-[#475569]">
            <Link href="/login" className="font-medium text-[#011848] hover:text-[#ef0001]">
              Voltar ao login
            </Link>
          </div>
        </form>

        <form className="bg-white shadow-xl rounded-2xl px-8 py-8 space-y-4" onSubmit={handleLookup}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-[#0b1a3c]">Consultar solicitacao</h3>
              <p className="text-xs text-[#475569]">Preencha nome e e-mail para acompanhar status e comentarios.</p>
            </div>
            {lookupLoading && <span className="text-xs text-[#475569]">Consultando...</span>}
          </div>

          {lookupError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {lookupError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              Nome completo
              <input
                type="text"
                value={lookupName}
                onChange={(event) => setLookupName(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="Ana Souza"
              />
            </label>
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              E-mail
              <input
                type="email"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="voce@empresa.com"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={lookupLoading}
            className="w-full flex items-center justify-center rounded-lg bg-[#011848] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ef0001] hover:text-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {lookupLoading ? "Consultando..." : "Consultar solicitacao"}
          </button>

          {lookupItem && (
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0b1a3c]">Solicitacao encontrada</p>
                  <p className="text-xs text-[#475569]">Criada em {new Date(lookupItem.createdAt).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0b1a3c] border">
                  {statusLabel(lookupItem.status)}
                </span>
              </div>

              {showAdminNote && (
                <div className="rounded-lg border bg-white px-3 py-2 text-sm text-[#0b1a3c]">
                  <strong>Comentario do admin:</strong> {adminNote}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0b1a3c]">Comentarios</p>
                {lookupComments.length === 0 ? (
                  <p className="text-xs text-[#475569]">Nenhum comentario ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {lookupComments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#0b1a3c]">
                            {comment.authorRole === "admin" ? "Admin" : "Solicitante"}: {comment.authorName}
                          </p>
                          <span className="text-[11px] text-[#64748b]">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#334155] whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                  rows={3}
                  placeholder="Adicionar comentario"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={commentSubmitting || !commentDraft.trim()}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold text-[#0b1a3c] hover:bg-white disabled:opacity-60"
                >
                  {commentSubmitting ? "Enviando..." : "Enviar comentario"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
