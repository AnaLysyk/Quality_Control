"use client";

import {
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiGlobe,
  FiLock,
  FiPlay,
  FiZap,
} from "react-icons/fi";

import {
  AUTOMATION_DOMAINS,
  AUTOMATION_ENVIRONMENTS,
  AUTOMATION_FLOWS,
  AUTOMATION_PILLARS,
} from "@/data/automationCatalog";

function maturityTone(maturity: (typeof AUTOMATION_DOMAINS)[number]["maturity"]) {
  if (maturity === "priority") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (maturity === "mapped") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function maturityLabel(maturity: (typeof AUTOMATION_DOMAINS)[number]["maturity"]) {
  if (maturity === "priority") return "Prioridade MVP";
  if (maturity === "mapped") return "Mapeado";
  return "PrÃ³xima fase";
}

function environmentTone(status: (typeof AUTOMATION_ENVIRONMENTS)[number]["status"]) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "planned") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function environmentLabel(status: (typeof AUTOMATION_ENVIRONMENTS)[number]["status"]) {
  if (status === "ready") return "Pronto";
  if (status === "planned") return "Planejado";
  return "Restrito";
}

function statusIcon(status: (typeof AUTOMATION_ENVIRONMENTS)[number]["status"]) {
  if (status === "ready") return <FiCheckCircle className="h-4 w-4" />;
  if (status === "planned") return <FiClock className="h-4 w-4" />;
  return <FiLock className="h-4 w-4" />;
}

export default function AutomationWorkbenchCatalog() {
  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">CatÃ¡logo inicial</p>
          <h3 className="text-3xl font-black tracking-[-0.04em] text-[var(--tc-text,#0b1a3c)]">DomÃ­nios jÃ¡ mapeados da coleÃ§Ã£o</h3>
          <p className="max-w-4xl text-sm leading-7 text-[var(--tc-text-secondary,#4b5563)]">
            O ponto correto nÃ£o Ã© clonar o Postman no front. O correto Ã© transformar os grupos de endpoint em fluxos orientados, com
            validaÃ§Ã£o de entrada, presets por ambiente e execuÃ§Ã£o centralizada no backend.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {AUTOMATION_DOMAINS.map((domain) => (
            <article
              key={domain.id}
              className="flex min-h-full flex-col rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">DomÃ­nio</p>
                  <h4 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{domain.title}</h4>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${maturityTone(domain.maturity)}`}>
                  {maturityLabel(domain.maturity)}
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-[var(--tc-text-secondary,#4b5563)]">{domain.summary}</p>

              <div className="mt-5 rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">Requests</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{domain.requestCount}</p>
              </div>

              <div className="mt-5 space-y-2 border-t border-[var(--tc-border,#e5e7eb)] pt-4">
                {domain.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white px-3 py-2 text-xs font-semibold text-[var(--tc-text,#0b1a3c)]"
                  >
                    {highlight}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <article className="rounded-[30px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
            <FiPlay className="h-4 w-4" />
            Fluxos prioritÃ¡rios
          </div>
          <div className="mt-5 space-y-4">
            {AUTOMATION_FLOWS.map((flow) => (
              <div key={flow.id} className="rounded-3xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{flow.title}</h4>
                  <span className="inline-flex rounded-full border border-[var(--tc-border,#d7deea)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted,#6b7280)]">
                    {flow.stack}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--tc-accent,#ef0001)]">{flow.audience}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--tc-text-secondary,#4b5563)]">{flow.objective}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {flow.steps.map((step, index) => (
                    <div
                      key={step}
                      className="rounded-2xl border border-[var(--tc-border,#e5e7eb)] bg-white px-3 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
                    >
                      {index + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[30px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
            <FiGlobe className="h-4 w-4" />
            Ambientes e base URL
          </div>
          <div className="mt-5 space-y-3">
            {AUTOMATION_ENVIRONMENTS.map((environment) => (
              <div key={environment.id} className="rounded-3xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{environment.title}</h4>
                    <p className="mt-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">{environment.baseUrl}</p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${environmentTone(environment.status)}`}>
                    {statusIcon(environment.status)}
                    {environmentLabel(environment.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--tc-text-secondary,#4b5563)]">{environment.note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <article className="rounded-[30px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
            <FiCpu className="h-4 w-4" />
            Arquitetura recomendada
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {AUTOMATION_PILLARS.map((pillar) => (
              <div key={pillar.id} className="rounded-3xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <h4 className="text-lg font-black tracking-[-0.03em] text-[var(--tc-text,#0b1a3c)]">{pillar.title}</h4>
                <p className="mt-3 text-sm leading-7 text-[var(--tc-text-secondary,#4b5563)]">{pillar.summary}</p>
                <div className="mt-4 space-y-2">
                  {pillar.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]">
                      <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tc-accent,#ef0001)]" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[30px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-text-muted,#6b7280)]">
            <FiZap className="h-4 w-4" />
            PrÃ³ximos passos
          </div>
          <div className="mt-5 space-y-3">
            {[
              "Converter a coleÃ§Ã£o Postman em catÃ¡logo versionado por domÃ­nio e fluxo.",
              "Criar executor backend com presets de ambiente, autenticaÃ§Ã£o e masking de payload.",
              "Montar telas de execuÃ§Ã£o rÃ¡pida para CPF, processos e cardscan.",
              "Registrar histÃ³rico com duraÃ§Ã£o, resultado final e evidÃªncias reutilizÃ¡veis.",
            ].map((item, index) => (
              <div key={item} className="rounded-3xl border border-[var(--tc-border,#e5e7eb)] bg-[var(--tc-surface-2,#f8fafc)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--tc-accent,#ef0001)]">Etapa {index + 1}</p>
                <p className="mt-2 text-sm leading-7 font-semibold text-[var(--tc-text,#0b1a3c)]">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

