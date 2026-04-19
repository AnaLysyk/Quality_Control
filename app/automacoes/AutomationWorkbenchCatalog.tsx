"use client";

import {
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiDatabase,
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
import { SC_INTEGRATION_COLLECTION } from "@/data/scIntegrationCollection";

function maturityTone(maturity: (typeof AUTOMATION_DOMAINS)[number]["maturity"]) {
  if (maturity === "priority") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (maturity === "mapped") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function maturityLabel(maturity: (typeof AUTOMATION_DOMAINS)[number]["maturity"]) {
  if (maturity === "priority") return "Prioridade MVP";
  if (maturity === "mapped") return "Mapeado";
  return "Próxima fase";
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Catálogo inicial</p>
          <h3 className="text-3xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">Domínios já mapeados da coleção</h3>
          <p className="max-w-4xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">
            O ponto correto não é clonar o Postman no front. O correto é transformar os grupos de endpoint em fluxos orientados, com
            validação de entrada, presets por ambiente e execução centralizada no backend.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {AUTOMATION_DOMAINS.map((domain) => (
            <article
              key={domain.id}
              className="flex min-h-full flex-col rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Domínio</p>
                  <h4 className="mt-2 text-xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{domain.title}</h4>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${maturityTone(domain.maturity)}`}>
                  {maturityLabel(domain.maturity)}
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{domain.summary}</p>

              <div className="mt-5 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Requests</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{domain.requestCount}</p>
              </div>

              <div className="mt-5 space-y-2 border-t border-(--tc-border,#e5e7eb) pt-4">
                {domain.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-xs font-semibold text-(--tc-text,#0b1a3c)"
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
        <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiPlay className="h-4 w-4" />
            Fluxos prioritários
          </div>
          <div className="mt-5 space-y-4">
            {AUTOMATION_FLOWS.map((flow) => (
              <div key={flow.id} className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{flow.title}</h4>
                  <span className="inline-flex rounded-full border border-(--tc-border,#d7deea) bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                    {flow.stack}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-(--tc-accent,#ef0001)">{flow.audience}</p>
                <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{flow.objective}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {flow.steps.map((step, index) => (
                    <div
                      key={step}
                      className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
                    >
                      {index + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiGlobe className="h-4 w-4" />
            Ambientes e base URL
          </div>
          <div className="mt-5 space-y-3">
            {AUTOMATION_ENVIRONMENTS.map((environment) => (
              <div key={environment.id} className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{environment.title}</h4>
                    <p className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">{environment.baseUrl}</p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${environmentTone(environment.status)}`}>
                    {statusIcon(environment.status)}
                    {environmentLabel(environment.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{environment.note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiCpu className="h-4 w-4" />
            Arquitetura recomendada
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {AUTOMATION_PILLARS.map((pillar) => (
              <div key={pillar.id} className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <h4 className="text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{pillar.title}</h4>
                <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{pillar.summary}</p>
                <div className="mt-4 space-y-2">
                  {pillar.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                      <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-(--tc-accent,#ef0001)" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
            <FiZap className="h-4 w-4" />
            Próximos passos
          </div>
          <div className="mt-5 space-y-3">
            {[
              "Converter a coleção Postman em catálogo versionado por domínio e fluxo.",
              "Criar executor backend com presets de ambiente, autenticação e masking de payload.",
              "Montar telas de execução rápida para CPF, processos e cardscan.",
              "Registrar histórico com duração, resultado final e evidências reutilizáveis.",
            ].map((item, index) => (
              <div key={item} className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Etapa {index + 1}</p>
                <p className="mt-2 text-sm leading-7 font-semibold text-(--tc-text,#0b1a3c)">{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[30px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Coleção importada</p>
          <h3 className="text-3xl font-black tracking-[-0.04em] text-(--tc-text,#0b1a3c)">{SC_INTEGRATION_COLLECTION.name}</h3>
          <p className="max-w-4xl text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{SC_INTEGRATION_COLLECTION.summary}</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">
              <FiDatabase className="h-4 w-4" />
              Resumo da importação
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Grupos</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{SC_INTEGRATION_COLLECTION.groups.length}</p>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Requests</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{SC_INTEGRATION_COLLECTION.totalRequests}</p>
              </div>
              <div className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">Foco</p>
                <p className="mt-2 text-sm font-bold leading-6 text-(--tc-text,#0b1a3c)">Tokens, processos e leitura operacional</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SC_INTEGRATION_COLLECTION.groups.map((group) => (
              <article
                key={group.id}
                className="flex min-h-full flex-col rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">Grupo</p>
                    <h4 className="mt-1 text-lg font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">{group.title}</h4>
                  </div>
                  <span className="inline-flex min-h-8 items-center rounded-full border border-(--tc-border,#d7deea) bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                    {group.requestCount}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-(--tc-text-secondary,#4b5563)">{group.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.sampleRequests.map((request) => (
                    <span
                      key={request}
                      className="inline-flex items-center rounded-full border border-(--tc-border,#e5e7eb) bg-white px-3 py-1 text-xs font-semibold text-(--tc-text,#0b1a3c)"
                    >
                      {request}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
