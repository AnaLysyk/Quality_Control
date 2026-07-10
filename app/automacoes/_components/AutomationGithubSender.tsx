"use client";

import { useEffect, useState } from "react";
import { FiGithub } from "react-icons/fi";

type GithubSourceOption = { id: string; name: string };

type AutomationGithubSenderProps = {
  defaultTitle?: string;
  defaultBody?: string;
  defaultLabels?: string[];
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisição");
  return json as T;
}

/**
 * Painel compacto e reutilizavel para enviar conteudo de automacao (script, resultado de
 * request, resumo de execucao) como issue no GitHub. Reaproveita a mesma fonte configurada
 * (BrainSourceConfig provider "github") e o mesmo endpoint ja usado pelo Brain.
 */
export function AutomationGithubSender({ defaultTitle = "", defaultBody = "", defaultLabels = [] }: AutomationGithubSenderProps) {
  const [sources, setSources] = useState<GithubSourceOption[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(defaultTitle);
    setBody(defaultBody);
  }, [defaultTitle, defaultBody]);

  useEffect(() => {
    fetchJson<{ sources?: Array<{ id: string; name: string; provider?: string | null; sourceType?: string; status?: string }> }>("/api/brain/settings/sources")
      .then((data) => {
        const options = (data.sources ?? []).filter(
          (item) => item.sourceType === "external_api" && (item.provider ?? "").toLowerCase() === "github" && item.status === "active",
        );
        setSources(options.map((item) => ({ id: item.id, name: item.name })));
        setSourceId((current) => current || options[0]?.id || "");
      })
      .catch(() => setSources([]));
  }, []);

  async function send() {
    if (!sourceId) {
      setError("Nenhuma fonte GitHub ativa configurada.");
      return;
    }
    if (!title.trim()) {
      setError("Informe um título para a issue.");
      return;
    }

    setSending(true);
    setError(null);
    setFeedback(null);
    try {
      const data = await fetchJson<{ issue?: { url?: string; number?: number } }>("/api/brain/integrations/github/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, title: title.trim(), body, labels: defaultLabels }),
      });
      setFeedback(`Issue #${data.issue?.number ?? "?"} criada: ${data.issue?.url ?? ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar ao GitHub");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[18px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-4">
      <div className="flex items-center gap-2">
        <FiGithub className="h-4 w-4 text-[var(--tc-text,#0b1a3c)]" />
        <h3 className="text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">Enviar ao GitHub</h3>
      </div>

      {sources.length ? (
        <div className="mt-3 grid gap-2">
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2 text-sm outline-none">
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da issue" className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2 text-sm outline-none" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Descrição/corpo da issue" rows={4} className="rounded-lg border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 py-2 text-sm outline-none" />
          <button type="button" onClick={send} disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--tc-accent,#ef0001)] bg-[#fff5f5] px-4 py-2 text-sm font-semibold text-[var(--tc-accent,#ef0001)] disabled:opacity-60">
            {sending ? "Enviando..." : "Criar issue no GitHub"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--tc-text-secondary,#4b5563)]">
          Nenhuma fonte GitHub ativa configurada. Configure em Configurações do Brain (fonte tipo API externa, provider &quot;github&quot;).
        </p>
      )}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {feedback ? <p className="mt-2 break-words text-sm text-emerald-600">{feedback}</p> : null}
    </section>
  );
}
