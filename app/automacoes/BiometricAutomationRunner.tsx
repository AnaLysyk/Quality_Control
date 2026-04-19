"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiImage,
  FiLoader,
  FiPlay,
  FiServer,
  FiShield,
} from "react-icons/fi";

type CompanyOption = {
  name: string;
  slug: string;
};

type FixtureOption = {
  index: number | null;
  isStandard: boolean;
  kind: "face" | "fingerprint";
  label: string;
  slug: string;
};

type MetaResponse = {
  access: {
    canConfigure: boolean;
    profileLabel: string;
    scopeLabel: string;
  };
  defaults: {
    faceFixture: string;
    fingerprintFixture: string;
    host?: string;
    mode: "above" | "below";
    port?: number;
    referenceLimit: number;
    user?: string;
    walletObservedLimit: number;
  };
  fixtures: FixtureOption[];
};

type RunnerResponse = {
  ok: true;
  result: {
    afterSummary: {
      faceCount: number;
      fingerprintCount: number;
      selectedFingerprintContentLength: number;
      selectedFingerprintFormat: string | null;
      selectedFingerprintPresent: boolean;
      status: string | null;
      totalBiometrics: number;
    };
    beforeSummary: {
      faceCount: number;
      fingerprintCount: number;
      selectedFingerprintContentLength: number;
      selectedFingerprintFormat: string | null;
      selectedFingerprintPresent: boolean;
      status: string | null;
      totalBiometrics: number;
    };
    companySlug: string | null;
    durationMs: number;
    faceIncluded: boolean;
    fingerprintBase64Length: number;
    fingerprintFormat: string;
    fingerprintIndex: number;
    fingerprintLabel: string;
    host: string | null;
    latestOutputPath: string;
    mode: "ABOVE" | "BELOW";
    outputPath: string;
    processId: string;
    putStatus: number;
    target: number;
    user: string | null;
  };
};

type Props = {
  activeCompanySlug: string | null;
  canConfigure: boolean;
  companies: CompanyOption[];
};

type FormState = {
  companySlug: string;
  faceFixture: string;
  includeFace: boolean;
  manualIndex: string;
  mode: "above" | "below";
  password: string;
  port: string;
  processId: string;
  protocol: string;
  selectedFixture: string;
  target: string;
  user: string;
  host: string;
};

const INITIAL_FORM: FormState = {
  companySlug: "",
  faceFixture: "face",
  includeFace: true,
  manualIndex: "",
  mode: "below",
  password: "",
  port: "",
  processId: "",
  protocol: "",
  selectedFixture: "anelar-esquerdo",
  target: "",
  user: "",
  host: "",
};

const BIOMETRIC_META_CACHE_KEY = "qc:automations:biometric-meta:v1";
const BIOMETRIC_META_CACHE_TTL_MS = 60_000;

type BiometricMetaCache = {
  cachedAt: number;
  meta: MetaResponse;
};

function applyMetaDefaults(current: FormState, nextMeta: MetaResponse): FormState {
  return {
    ...current,
    faceFixture: nextMeta.defaults.faceFixture,
    host: nextMeta.defaults.host || current.host,
    mode: nextMeta.defaults.mode,
    port: nextMeta.defaults.port ? String(nextMeta.defaults.port) : current.port,
    selectedFixture: nextMeta.defaults.fingerprintFixture,
    user: nextMeta.defaults.user || current.user,
  };
}

function readBiometricMetaCache() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(BIOMETRIC_META_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BiometricMetaCache;
    if (Date.now() - parsed.cachedAt > BIOMETRIC_META_CACHE_TTL_MS) return null;
    return parsed.meta;
  } catch {
    return null;
  }
}

function writeBiometricMetaCache(meta: MetaResponse) {
  if (typeof window === "undefined") return;

  try {
    const payload: BiometricMetaCache = { cachedAt: Date.now(), meta };
    window.sessionStorage.setItem(BIOMETRIC_META_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

export default function BiometricAutomationRunner({ activeCompanySlug, canConfigure, companies }: Props) {
  const [meta, setMeta] = useState<MetaResponse | null>(() => readBiometricMetaCache());
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(() => readBiometricMetaCache() === null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<RunnerResponse["result"] | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState<FormState>(() => {
    const cachedMeta = readBiometricMetaCache();
    return cachedMeta ? applyMetaDefaults(INITIAL_FORM, cachedMeta) : INITIAL_FORM;
  });

  useEffect(() => {
    const cachedMeta = readBiometricMetaCache();
    if (cachedMeta) {
      setMeta(cachedMeta);
      setMetaLoading(false);
      setMetaError(null);
      return;
    }

    let active = true;

    async function loadMeta() {
      setMetaLoading(true);
      setMetaError(null);

      try {
        const response = await fetch("/api/automations/griaule/biometrics", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as MetaResponse | { error?: string } | null;

        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || "Falha ao carregar metadata biométrica.");
        }

        if (!active) return;

        const nextMeta = payload as MetaResponse;
        writeBiometricMetaCache(nextMeta);
        setMeta(nextMeta);
        setForm((current) => applyMetaDefaults(current, nextMeta));
      } catch (error) {
        if (!active) return;
        setMetaError(error instanceof Error ? error.message : "Falha ao carregar metadata biométrica.");
      } finally {
        if (active) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (form.companySlug) return;
    const griaule = companies.find((company) => company.slug === "griaule");
    const fallbackCompany = companies.find((company) => company.slug === activeCompanySlug) || griaule || companies[0] || null;
    if (!fallbackCompany) return;
    setForm((current) => ({ ...current, companySlug: fallbackCompany.slug }));
  }, [activeCompanySlug, companies, form.companySlug]);

  useEffect(() => {
    if (companies.length === 0) return;
    if (companies.some((company) => company.slug === form.companySlug)) return;
    const griaule = companies.find((company) => company.slug === "griaule");
    const fallbackCompany = companies.find((company) => company.slug === activeCompanySlug) || griaule || companies[0] || null;
    if (!fallbackCompany) return;
    setForm((current) => ({ ...current, companySlug: fallbackCompany.slug }));
  }, [activeCompanySlug, companies, form.companySlug]);

  const fingerprintFixtures = useMemo(
    () => (meta?.fixtures || []).filter((fixture) => fixture.kind === "fingerprint"),
    [meta],
  );
  const faceFixtures = useMemo(
    () => (meta?.fixtures || []).filter((fixture) => fixture.kind === "face"),
    [meta],
  );
  const selectedFixture = useMemo(
    () => fingerprintFixtures.find((fixture) => fixture.slug === form.selectedFixture) || null,
    [fingerprintFixtures, form.selectedFixture],
  );
  const effectiveIndex = selectedFixture?.index ?? (form.manualIndex ? Number(form.manualIndex) : NaN);

  useEffect(() => {
    if (fingerprintFixtures.length === 0) return;
    if (fingerprintFixtures.some((fixture) => fixture.slug === form.selectedFixture)) return;
    setForm((current) => ({ ...current, selectedFixture: fingerprintFixtures[0].slug }));
  }, [fingerprintFixtures, form.selectedFixture]);

  useEffect(() => {
    if (faceFixtures.length === 0) return;
    if (faceFixtures.some((fixture) => fixture.slug === form.faceFixture)) return;
    setForm((current) => ({ ...current, faceFixture: faceFixtures[0].slug }));
  }, [faceFixtures, form.faceFixture]);

  useEffect(() => {
    if (!selectedFixture || selectedFixture.index === null) return;
    setForm((current) => {
      const nextIndex = String(selectedFixture.index);
      return current.manualIndex === nextIndex ? current : { ...current, manualIndex: nextIndex };
    });
  }, [selectedFixture]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunError(null);
    setResult(null);

    if (!form.processId.trim() && !form.protocol.trim()) {
      setRunError("Informe o ID do processo ou o protocolo.");
      return;
    }

    if (!selectedFixture) {
      setRunError("Selecione uma digital válida.");
      return;
    }

    if (!Number.isFinite(effectiveIndex)) {
      setRunError("Informe um índice de dedo válido para a fixture escolhida.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/automations/griaule/biometrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanced:
            canConfigure && (form.host.trim() || form.port.trim() || form.user.trim() || form.password.trim())
              ? {
                  host: form.host.trim() || undefined,
                  password: form.password || undefined,
                  port: form.port.trim() ? Number(form.port) : undefined,
                  user: form.user.trim() || undefined,
                }
              : undefined,
          companySlug: form.companySlug || undefined,
          faceFixture: form.includeFace ? form.faceFixture || undefined : undefined,
          includeFace: form.includeFace,
          mode: form.mode,
          processId: form.processId.trim() || undefined,
          protocol: form.protocol.trim() || undefined,
          target: form.target.trim() ? Number(form.target) : undefined,
          fingerprint: {
            fixture: selectedFixture.slug,
            index: Number(effectiveIndex),
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as RunnerResponse | { error?: string } | null;

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "Falha ao executar o fluxo biométrico.");
      }

      setResult((payload as RunnerResponse).result);
      setForm((current) => ({ ...current, password: "" }));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao executar o fluxo biométrico.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Fluxo executável</p>
            <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">Biometria Griaule</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
              Runner visual para anexar digital e face na API biométrica da Griaule, preservando a regra real de Base64 da Wallet.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
            <FiShield className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            {canConfigure ? "Configuração liberada" : "Escopo operacional"}
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Empresa</span>
              <select
                value={form.companySlug}
                onChange={(event) => setForm((current) => ({ ...current, companySlug: event.target.value }))}
                disabled={companies.length === 0}
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                {companies.length === 0 ? (
                  <option value="">Nenhuma empresa disponível</option>
                ) : (
                  companies.map((company) => (
                    <option key={company.slug} value={company.slug}>
                      {company.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Digital</span>
              <select
                value={form.selectedFixture}
                onChange={(event) => setForm((current) => ({ ...current, selectedFixture: event.target.value }))}
                disabled={fingerprintFixtures.length === 0}
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                {fingerprintFixtures.length === 0 ? (
                  <option value="">Nenhuma digital disponível</option>
                ) : (
                  fingerprintFixtures.map((fixture) => (
                    <option key={fixture.slug} value={fixture.slug}>
                      {fixture.label}
                      {fixture.isStandard ? "" : " · avulsa"}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Processo ID</span>
              <input
                value={form.processId}
                onChange={(event) => setForm((current) => ({ ...current, processId: event.target.value }))}
                placeholder="84"
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Protocolo</span>
              <input
                value={form.protocol}
                onChange={(event) => setForm((current) => ({ ...current, protocol: event.target.value }))}
                placeholder="220260000084"
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Modo</span>
              <select
                value={form.mode}
                onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as "above" | "below" }))}
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              >
                <option value="below">Below · reduzir para o limite</option>
                <option value="above">Above · inflar acima do alvo</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Índice do dedo</span>
              <input
                value={form.manualIndex}
                onChange={(event) => setForm((current) => ({ ...current, manualIndex: event.target.value }))}
                placeholder="8"
                disabled={selectedFixture?.index !== null}
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#6b7280)"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Face</span>
              <select
                value={form.faceFixture}
                onChange={(event) => setForm((current) => ({ ...current, faceFixture: event.target.value }))}
                disabled={!form.includeFace || faceFixtures.length === 0}
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#6b7280)"
              >
                {faceFixtures.length === 0 ? (
                  <option value="">Nenhuma face disponível</option>
                ) : (
                  faceFixtures.map((fixture) => (
                    <option key={fixture.slug} value={fixture.slug}>
                      {fixture.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Alvo Base64</span>
              <input
                value={form.target}
                onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
                placeholder={form.mode === "below" ? "500000" : "520000"}
                className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-4">
            <label className="inline-flex items-center gap-3 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              <input
                type="checkbox"
                checked={form.includeFace}
                onChange={(event) => setForm((current) => ({ ...current, includeFace: event.target.checked }))}
                className="h-4 w-4 rounded border-(--tc-border,#d7deea)"
              />
              Enviar face junto da digital
            </label>

            {canConfigure ? (
              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                <FiServer className="h-4 w-4" />
                {showAdvanced ? "Ocultar ambiente" : "Ajustar ambiente"}
              </button>
            ) : (
              <div className="text-sm font-semibold text-(--tc-text-muted,#6b7280)">Usuário TC consome o preset já configurado.</div>
            )}
          </div>

          {showAdvanced && canConfigure ? (
            <div className="grid gap-4 rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Host</span>
                <input
                  value={form.host}
                  onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
                  placeholder={meta?.defaults.host || "172.16.1.146"}
                  className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Porta</span>
                <input
                  value={form.port}
                  onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                  placeholder={meta?.defaults.port ? String(meta.defaults.port) : "8100"}
                  className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Usuário API</span>
                <input
                  value={form.user}
                  onChange={(event) => setForm((current) => ({ ...current, user: event.target.value }))}
                  placeholder={meta?.defaults.user || "admin"}
                  className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Senha API</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Usa SC_BIOMETRICS_API_PASSWORD se vazio"
                  className="min-h-12 w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm font-semibold text-(--tc-text,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                />
              </label>
            </div>
          ) : null}

          {runError ? (
            <div className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{runError}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-(--tc-text-secondary,#4b5563)">
              Informe processo ou protocolo. O backend resolve token, GET antes, PUT biométrico e GET depois.
            </div>
            <button
              type="submit"
              disabled={metaLoading || isSubmitting || fingerprintFixtures.length === 0}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlay className="h-4 w-4" />}
              Executar runner
            </button>
          </div>
        </form>
      </article>

      <aside className="space-y-4">
        <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiCpu className="h-4 w-4" />
            Preset biométrico
          </div>

          {metaLoading ? (
            <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563)">
              <FiLoader className="h-4 w-4 animate-spin" />
              Carregando fixtures locais...
            </div>
          ) : metaError ? (
            <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
              {metaError}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Limite de referência</p>
                  <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{meta?.defaults.referenceLimit.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Wallet observada</p>
                  <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{meta?.defaults.walletObservedLimit.toLocaleString("pt-BR")}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-(--tc-text,#0b1a3c)">
                  <FiImage className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                  Fixtures detectadas
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(meta?.fixtures || []).map((fixture) => (
                    <span
                      key={fixture.slug}
                      className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                    >
                      {fixture.label}
                    </span>
                  ))}
                </div>
              </div>

              {canConfigure && meta?.defaults.host ? (
                <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-(--tc-text,#0b1a3c)">
                    <FiServer className="h-4 w-4 text-(--tc-accent,#ef0001)" />
                    Preset atual
                  </div>
                  <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                    {meta.defaults.user}@{meta.defaults.host}:{meta.defaults.port}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </article>

        <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiActivity className="h-4 w-4" />
            Última execução
          </div>

          {!result ? (
            <div className="mt-5 rounded-3xl border border-dashed border-(--tc-border,#d7deea) px-4 py-5 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
              Execute o runner para validar a cadeia completa: autenticação, leitura inicial, PUT biométrico e leitura final.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                    <FiCheckCircle className="h-4 w-4" />
                    PUT {result.putStatus}
                  </div>
                  <p className="mt-2 text-sm text-emerald-700">Processo {result.processId}</p>
                </div>
                <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
                    <FiClock className="h-4 w-4" />
                    {formatDuration(result.durationMs)}
                  </div>
                  <p className="mt-2 text-sm text-sky-700">
                    {result.mode} · {result.fingerprintBase64Length.toLocaleString("pt-BR")} chars
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <p className="text-sm font-bold text-(--tc-text,#0b1a3c)">{result.fingerprintLabel}</p>
                <div className="mt-3 grid gap-2 text-sm text-(--tc-text-secondary,#4b5563)">
                  <p>
                    Empresa: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.companySlug || "global"}</span>
                  </p>
                  <p>
                    Índice: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.fingerprintIndex}</span>
                  </p>
                  <p>
                    Formato: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.fingerprintFormat}</span>
                  </p>
                  <p>
                    Alvo: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.target.toLocaleString("pt-BR")}</span>
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Antes</p>
                  <div className="mt-3 space-y-2 text-sm text-(--tc-text-secondary,#4b5563)">
                    <p>
                      Digitais: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.beforeSummary.fingerprintCount}</span>
                    </p>
                    <p>
                      Face: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.beforeSummary.faceCount}</span>
                    </p>
                    <p>
                      Índice presente: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.beforeSummary.selectedFingerprintPresent ? "Sim" : "Não"}</span>
                    </p>
                    <p>
                      Conteúdo: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.beforeSummary.selectedFingerprintContentLength.toLocaleString("pt-BR")}</span>
                    </p>
                  </div>
                </div>
                <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Depois</p>
                  <div className="mt-3 space-y-2 text-sm text-(--tc-text-secondary,#4b5563)">
                    <p>
                      Digitais: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.afterSummary.fingerprintCount}</span>
                    </p>
                    <p>
                      Face: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.afterSummary.faceCount}</span>
                    </p>
                    <p>
                      Índice presente: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.afterSummary.selectedFingerprintPresent ? "Sim" : "Não"}</span>
                    </p>
                    <p>
                      Conteúdo: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.afterSummary.selectedFingerprintContentLength.toLocaleString("pt-BR")}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
                <p>
                  Saída versionada: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.outputPath}</span>
                </p>
                <p>
                  Último snapshot: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.latestOutputPath}</span>
                </p>
                {result.host ? (
                  <p>
                    Host: <span className="font-semibold text-(--tc-text,#0b1a3c)">{result.host}</span>
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </article>
      </aside>
    </section>
  );
}
