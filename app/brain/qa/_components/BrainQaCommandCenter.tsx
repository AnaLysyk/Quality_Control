"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { FiCheckCircle, FiClipboard, FiCopy, FiDatabase, FiFileText, FiPlayCircle, FiShield, FiZap } from "react-icons/fi";

import { fetchApi } from "@/lib/api";

type BrainEvalCase = {
  id: string;
  suite: string;
  title: string;
  userInput: string;
  expectedBehavior: string[];
  evidenceRequired: string[];
  status: string;
  priority: string;
};

type BrainPromptTemplate = {
  id: string;
  name: string;
  version: string;
  owner: string;
  purpose: string;
  guardrails: string[];
  expectedOutput: string[];
  linkedEvalIds: string[];
  status: string;
};

type BrainQuickAction = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  outputType: string;
  requiredEvidence: string[];
};

type RegistryPayload = {
  generatedAt: string;
  summary: {
    evals: number;
    readyEvals: number;
    prompts: number;
    activePrompts: number;
    quickActions: number;
  };
  evals: BrainEvalCase[];
  prompts: BrainPromptTemplate[];
  quickActions: BrainQuickAction[];
};

async function fetcher(path: string) {
  const response = await fetchApi(path, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Nao foi possivel carregar o QA Registry do Brain.");
  }
  return payload as RegistryPayload;
}

function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(value);
}

function buildEvalText(item: BrainEvalCase) {
  return [
    `Eval: ${item.title}`,
    `Suite: ${item.suite}`,
    `Entrada: ${item.userInput}`,
    "Comportamento esperado:",
    ...item.expectedBehavior.map((line) => `- ${line}`),
    "Evidencias obrigatorias:",
    ...item.evidenceRequired.map((line) => `- ${line}`),
  ].join("\n");
}

function buildPromptText(item: BrainPromptTemplate) {
  return [
    `Prompt: ${item.id}`,
    `Versao: ${item.version}`,
    `Objetivo: ${item.purpose}`,
    "Guardrails:",
    ...item.guardrails.map((line) => `- ${line}`),
    "Saida esperada:",
    ...item.expectedOutput.map((line) => `- ${line}`),
  ].join("\n");
}

export function BrainQaCommandCenter() {
  const { data, error, isLoading } = useSWR("/api/brain/qa-registry", fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });
  const [tab, setTab] = useState<"actions" | "evals" | "prompts">("actions");

  const activeItems = useMemo(() => {
    if (!data) return [];
    if (tab === "evals") return data.evals;
    if (tab === "prompts") return data.prompts;
    return data.quickActions;
  }, [data, tab]);

  return (
    <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
            <FiShield className="h-4 w-4" /> Brain QA Command Center
          </span>
          <h1 className="mt-3 text-2xl font-black text-(--tc-text,#0b1a3c)">Validações, prompts e ações rápidas do Brain</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
            Central para transformar o chat em ferramenta operacional de QA: valida fluxo, gera ticket, cria caso Qase, controla prompt e mede se a resposta do Brain presta.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error.message}</div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {[
          ["Evals", data?.summary.evals ?? 0, FiPlayCircle],
          ["Evals prontos", data?.summary.readyEvals ?? 0, FiCheckCircle],
          ["Prompts", data?.summary.prompts ?? 0, FiFileText],
          ["Prompts ativos", data?.summary.activePrompts ?? 0, FiDatabase],
          ["Ações", data?.summary.quickActions ?? 0, FiZap],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{String(label)}</p>
              <Icon className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            </div>
            <p className="mt-1 text-2xl font-black text-(--tc-text,#0b1a3c)">{isLoading ? "..." : String(value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          ["actions", "Ações rápidas"],
          ["evals", "Eval Center"],
          ["prompts", "Prompt Registry"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as typeof tab)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${tab === id ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white" : "border-(--tc-border,#d7deea) bg-white text-(--tc-text,#0b1a3c)"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {activeItems.map((item) => {
          if (tab === "actions") {
            const action = item as BrainQuickAction;
            return (
              <article key={action.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-(--tc-text,#0b1a3c)">{action.label}</h2>
                    <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{action.description}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--tc-text-muted,#6b7280)">{action.outputType}</span>
                </div>
                <div className="mt-3 rounded-xl border border-(--tc-border,#d7deea) bg-white p-3 font-mono text-xs leading-5 text-(--tc-text,#0b1a3c)">{action.prompt}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {action.requiredEvidence.map((evidence) => (
                    <span key={evidence} className="rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[11px] font-semibold text-(--tc-text-muted,#6b7280)">{evidence}</span>
                  ))}
                </div>
                <button type="button" onClick={() => copyToClipboard(action.prompt)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-xs font-bold text-(--tc-text,#0b1a3c)">
                  <FiCopy className="h-3.5 w-3.5" /> Copiar prompt
                </button>
              </article>
            );
          }

          if (tab === "evals") {
            const evalCase = item as BrainEvalCase;
            return (
              <article key={evalCase.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">{evalCase.suite}</p>
                    <h2 className="mt-1 text-base font-extrabold text-(--tc-text,#0b1a3c)">{evalCase.title}</h2>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--tc-text-muted,#6b7280)">{evalCase.status}</span>
                </div>
                <p className="mt-3 rounded-xl border border-(--tc-border,#d7deea) bg-white p-3 text-sm font-semibold text-(--tc-text,#0b1a3c)">{evalCase.userInput}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-extrabold text-(--tc-text,#0b1a3c)">Esperado</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{evalCase.expectedBehavior.map((line) => <li key={line}>• {line}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-(--tc-text,#0b1a3c)">Evidência</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{evalCase.evidenceRequired.map((line) => <li key={line}>• {line}</li>)}</ul>
                  </div>
                </div>
                <button type="button" onClick={() => copyToClipboard(buildEvalText(evalCase))} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-xs font-bold text-(--tc-text,#0b1a3c)">
                  <FiClipboard className="h-3.5 w-3.5" /> Copiar eval
                </button>
              </article>
            );
          }

          const prompt = item as BrainPromptTemplate;
          return (
            <article key={prompt.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-(--tc-accent,#ef0001)">{prompt.id}</p>
                  <h2 className="mt-1 text-base font-extrabold text-(--tc-text,#0b1a3c)">{prompt.name}</h2>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--tc-text-muted,#6b7280)">v{prompt.version}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{prompt.purpose}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-extrabold text-(--tc-text,#0b1a3c)">Guardrails</p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{prompt.guardrails.map((line) => <li key={line}>• {line}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs font-extrabold text-(--tc-text,#0b1a3c)">Saída esperada</p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-(--tc-text-secondary,#4b5563)">{prompt.expectedOutput.map((line) => <li key={line}>• {line}</li>)}</ul>
                </div>
              </div>
              <button type="button" onClick={() => copyToClipboard(buildPromptText(prompt))} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-xs font-bold text-(--tc-text,#0b1a3c)">
                <FiCopy className="h-3.5 w-3.5" /> Copiar definição
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
