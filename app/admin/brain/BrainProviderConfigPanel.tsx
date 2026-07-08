"use client";

import { useEffect, useMemo, useState } from "react";

type ProviderId = "groq" | "gemini" | "openrouter";

type ProviderConfig = {
  provider: ProviderId;
  enabled: boolean;
  model: string | null;
  models: string[];
  priority: number;
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  strictFreeModels: boolean;
  timeoutMs: number | null;
  maxOutputTokens: number | null;
};

type ProviderPayload = {
  configs: ProviderConfig[];
  keyStatus: Record<ProviderId, { configured: boolean }>;
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  groq: "Groq",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

const EMPTY_KEY_STATUS: ProviderPayload["keyStatus"] = {
  groq: { configured: false },
  gemini: { configured: false },
  openrouter: { configured: false },
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisicao");
  return json as T;
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function splitModels(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function numberValue(value: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

export function BrainProviderConfigPanel() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [keyStatus, setKeyStatus] = useState<ProviderPayload["keyStatus"]>(EMPTY_KEY_STATUS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const orderedConfigs = useMemo(
    () => [...configs].sort((left, right) => left.priority - right.priority),
    [configs],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<ProviderPayload>("/api/admin/brain/provider-config");
      setConfigs(payload.configs ?? []);
      setKeyStatus(payload.keyStatus ?? EMPTY_KEY_STATUS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar providers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateConfig(provider: ProviderId, patch: Partial<ProviderConfig>) {
    setConfigs((current) =>
      current.map((config) => config.provider === provider ? { ...config, ...patch } : config),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = await fetchJson<ProviderPayload>("/api/admin/brain/provider-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      setConfigs(payload.configs ?? []);
      setKeyStatus(payload.keyStatus ?? EMPTY_KEY_STATUS);
      setFeedback("Configuracao salva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuracao");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="fixed right-4 top-20 z-[2147483001] max-h-[calc(100dvh-6rem)] w-[min(460px,calc(100vw-2rem))] overflow-auto rounded-lg border border-cyan-100/20 bg-slate-950/95 p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/60">Brain IA</p>
          <h2 className="mt-1 text-base font-black">Providers</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
            Os tokens das IAs não são salvos aqui. Configure GROQ_API_KEY, GEMINI_API_KEY e OPENROUTER_API_KEY no ambiente seguro do servidor.
          </p>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || loading || configs.length === 0}
          className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading || saving}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-white/10 disabled:opacity-60"
        >
          Recarregar
        </button>
      </div>

      {error ? <p className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</p> : null}
      {feedback ? <p className="mt-3 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{feedback}</p> : null}
      {loading ? <p className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Carregando providers...</p> : null}

      <div className="mt-4 grid gap-3">
        {orderedConfigs.map((config) => (
          <section key={config.provider} className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black">{PROVIDER_LABELS[config.provider]}</h3>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  Chave: {keyStatus[config.provider]?.configured ? "configurada" : "não configurada"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(event) => updateConfig(config.provider, { enabled: event.target.checked })}
                />
                Ativo
              </label>
            </div>

            <div className="mt-3 grid gap-2">
              <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                Modelo principal
                <input
                  value={config.model ?? ""}
                  onChange={(event) => updateConfig(config.provider, { model: event.target.value || null })}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                Modelos fallback, separados por vírgula
                <input
                  value={config.models.join(", ")}
                  onChange={(event) => updateConfig(config.provider, { models: splitModels(event.target.value) })}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                  Prioridade
                  <input
                    type="number"
                    value={numberValue(config.priority)}
                    onChange={(event) => updateConfig(config.provider, { priority: toOptionalNumber(event.target.value) ?? 100 })}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                  Timeout
                  <input
                    type="number"
                    value={numberValue(config.timeoutMs)}
                    onChange={(event) => updateConfig(config.provider, { timeoutMs: toOptionalNumber(event.target.value) })}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                  Limite diário de requests
                  <input
                    type="number"
                    value={numberValue(config.dailyRequestLimit)}
                    onChange={(event) => updateConfig(config.provider, { dailyRequestLimit: toOptionalNumber(event.target.value) })}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                  Limite diário de tokens
                  <input
                    type="number"
                    value={numberValue(config.dailyTokenLimit)}
                    onChange={(event) => updateConfig(config.provider, { dailyTokenLimit: toOptionalNumber(event.target.value) })}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-300">
                  Max output tokens
                  <input
                    type="number"
                    value={numberValue(config.maxOutputTokens)}
                    onChange={(event) => updateConfig(config.provider, { maxOutputTokens: toOptionalNumber(event.target.value) })}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 pt-5 text-[11px] font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.strictFreeModels}
                    onChange={(event) => updateConfig(config.provider, { strictFreeModels: event.target.checked })}
                  />
                  Strict free models
                </label>
              </div>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
