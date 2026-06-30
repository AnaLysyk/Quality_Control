import { FiActivity, FiBarChart2, FiCheckCircle, FiCpu, FiLayers, FiPlayCircle } from "react-icons/fi";

import { internalQualityControlCompany, playwrightQualityControlRules } from "@/data/internalQualityControlCompanySeed";

export const dynamic = "force-dynamic";

const flow = [
  "Teste Playwright",
  "Run automatizada",
  "Relatorio do projeto",
  "Central da empresa",
  "Visao geral",
  "Brain",
];

export default function QualityControlAutomationPage() {
  return (
    <main className="min-h-screen bg-(--page-bg,#f5f7fb) px-4 py-6 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                <FiCpu className="h-4 w-4" /> Arquitetura interna
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-(--tc-text,#0b1a3c)">{internalQualityControlCompany.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{internalQualityControlCompany.summary}</p>
            </div>
            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-primary,#011848) px-4 py-3 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Framework oficial</p>
              <p className="mt-1 text-xl font-black">{internalQualityControlCompany.automationFramework}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2">
              <FiLayers className="h-5 w-5 text-(--tc-accent,#ef0001)" />
              <h2 className="text-lg font-extrabold text-(--tc-text,#0b1a3c)">Projetos internos do produto</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {internalQualityControlCompany.projects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-extrabold text-(--tc-text,#0b1a3c)">{project.name}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-(--tc-text-muted,#6b7280)">{project.area}</p>
                    </div>
                    <span className="rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--tc-text-muted,#6b7280)">{project.priority}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{project.goal}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.suites.map((suite) => (
                      <span key={suite} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-(--tc-text,#0b1a3c)">{suite}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-extrabold text-(--tc-text,#0b1a3c)">Regras Playwright</h2>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                {playwrightQualityControlRules.map((rule) => (
                  <li key={rule} className="rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2">{rule}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FiActivity className="h-5 w-5 text-(--tc-accent,#ef0001)" />
                <h2 className="text-lg font-extrabold text-(--tc-text,#0b1a3c)">Fluxo rastreável</h2>
              </div>
              <div className="mt-3 space-y-2">
                {flow.map((item, index) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-(--tc-primary,#011848) text-xs font-black text-white">{index + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <section className="rounded-[24px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#fff) p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm text-(--tc-text-secondary,#4b5563)">
            <span className="inline-flex items-center gap-2 font-bold text-(--tc-text,#0b1a3c)"><FiPlayCircle className="h-4 w-4" /> Próxima validação manual:</span>
            abrir a área de automações, criar ou executar uma spec Playwright e conferir se o resultado pode alimentar run, central, visão geral e Brain.
            <span className="inline-flex items-center gap-2 font-bold text-(--tc-text,#0b1a3c)"><FiBarChart2 className="h-4 w-4" /> Indicadores:</span>
            suites, runs, score, gate, tendência e nota executiva.
          </div>
        </section>
      </div>
    </main>
  );
}
