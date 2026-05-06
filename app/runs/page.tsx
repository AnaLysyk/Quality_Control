"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompanySelector } from "../components/CompanySelector";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useClientContext } from "@/context/ClientContext";
import { buildCompanyPathForAccess } from "@/lib/companyRoutes";
import { isInstitutionalCompanyAccount } from "@/lib/activeIdentity";

export default function RunsIndexPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const { clients } = useClientContext();
  const institutionalCompanyContext = isInstitutionalCompanyAccount(user ?? null);
  const fallbackClientSlug = clients[0]?.slug ?? null;
  const companySlug = user?.clientSlug ?? user?.defaultClientSlug ?? fallbackClientSlug;
  const routeInput = {
    isGlobalAdmin: user?.isGlobalAdmin === true,
    permissionRole: user?.permissionRole ?? null,
    role: user?.role ?? null,
    companyRole: user?.companyRole ?? null,
    userOrigin:
      (user as { userOrigin?: string | null } | null)?.userOrigin ??
      (user as { user_origin?: string | null } | null)?.user_origin ??
      null,
    companyCount: clients.length,
    clientSlug: user?.clientSlug ?? null,
    defaultClientSlug: user?.defaultClientSlug ?? null,
  };

  useEffect(() => {
    if (!institutionalCompanyContext || !companySlug) return;
    router.replace(
      buildCompanyPathForAccess(companySlug, "runs", {
        ...routeInput,
        clientSlug: companySlug,
      }),
    );
  }, [companySlug, institutionalCompanyContext, router, routeInput]);

  if (institutionalCompanyContext && companySlug) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Runs</p>
          <h1 className="text-2xl font-bold">Abrindo contexto da empresa...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c) px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.5em] text-(--tc-accent)">Runs</p>
          <h1 className="text-3xl font-bold">Selecione a empresa</h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            As execuções de testes ficam organizadas por empresa. Escolha abaixo para abrir o hub de runs correspondente.
          </p>
        </header>

        <CompanySelector
          title="Empresas com runs"
          description="Acesso rápido às execuções mais recentes, métricas e histórico de resultados."
          buildHref={(company) =>
            buildCompanyPathForAccess(company.clientSlug, "runs", {
              ...routeInput,
              clientSlug: company.clientSlug,
            })
          }
          ctaLabel={(company) => (company.role === "ADMIN" ? "Gerenciar runs" : "Ver runs")}
        />
      );
    }

    return (
      <div className="operation-runs-module space-y-5">
        <div className="operation-panel flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/4 px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Runs renderizadas</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{filteredRuns.length} execucoes no recorte atual</h3>
            <p className="mt-1 text-sm leading-6 text-white/58">
              Empresa {selectedCompany?.name ?? "sem empresa"} com aplicacao {selectedApplication?.name ?? "todas"}.
            </p>
          </div>
          <span className="rounded-full border border-(--tc-accent,#ef0001)/35 bg-(--tc-accent,#ef0001)/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffd2d2]">
            {runsState.loading ? "sincronizando" : "dados carregados"}
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="operation-panel rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Agora</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Execucoes em andamento</h3>
              </div>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
                {liveRuns.length} ativas
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {liveRuns.length > 0 ? (
                liveRuns.slice(0, 6).map((run) => (
                  <div key={run.id} className="operation-run-card rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{run.title}</div>
                        <div className="mt-1 text-xs text-white/52">
                          {run.applicationLabel} {run.projectCode ? `| ${run.projectCode}` : ""} {run.runId ? `| Run ${run.runId}` : ""}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusToneClasses(run.statusKey)}`}>
                        {run.statusLabel}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/58">
                      <span>Pass rate {formatPercent(run.passRate)}</span>
                      <span>{run.stats.total} casos</span>
                      <span>{run.responsibleLabel ?? "Sem responsavel"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="operation-empty-inline rounded-[20px] border border-dashed border-white/10 bg-white/4 px-4 py-6 text-sm text-white/58">
                  Nenhuma run esta em andamento agora para este recorte.
                </p>
              )}
            </div>
          </div>

          <div className="operation-panel rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Historico</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Ultimas execucoes</h3>
              </div>
              <span className="text-xs text-white/52">
                {runsState.updatedAt ? `Atualizado ${formatDateTime(new Date(runsState.updatedAt).toISOString(), locale)}` : "Sem sincronizacao"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {filteredRuns.slice(0, 10).map((run) => (
                <div key={`history-${run.id}`} className="operation-run-card flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-white/4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{run.title}</div>
                    <div className="mt-1 truncate text-xs text-white/52">
                      {run.applicationLabel} {run.projectCode ? `| ${run.projectCode}` : ""} {run.createdAt ? `| ${formatDateTime(run.createdAt, locale)}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/60">{formatPercent(run.passRate)}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusToneClasses(run.statusKey)}`}>
                      {run.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderApplicationsModule() {
    if (applicationsState.loading && applicationsState.items.length === 0) {
      return <LoadingBlock label="aplicacoes da empresa" />;
    }
    if (applicationsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar as aplicacoes" description={applicationsState.error} />;
    }
    if (applicationsState.items.length === 0) {
      return (
        <EmptyBlock
          title="Nenhuma aplicacao encontrada"
          description="Assim que a empresa tiver aplicacoes cadastradas ou integradas, elas aparecem aqui."
        />
      );
    }

    return (
      <div className="space-y-3">
        {applicationsState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {applicationsState.warning}
          </div>
        ) : null}
        {applicationsState.items.map((application) => {
          const isSelected = selectedApplication?.id === application.id;
          return (
            <button
              key={application.id}
              type="button"
              onClick={() => replaceQuery({ applicationId: isSelected ? null : application.id })}
              className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
                isSelected
                  ? "border-(--tc-accent,#ef0001)/70 bg-(--tc-accent,#ef0001)/10"
                  : "border-white/10 bg-white/4 hover:border-white/18 hover:bg-white/7"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{application.name}</span>
                  {application.qaseProjectCode ? (
                    <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                      {application.qaseProjectCode}
                    </span>
                  ) : null}
                  {application.unavailable ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                      indisponivel
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      {application.active ? "ativa" : "inativa"}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  /{application.slug} {application.source ? `| ${application.source}` : ""}{" "}
                  {application.accessMessage ? `| ${application.accessMessage}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/64">
                <span>{isSelected ? "Recorte ativo" : "Usar no recorte"}</span>
                <FiArrowRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderPlansModule() {
    if (plansState.loading && plansState.items.length === 0) {
      return <LoadingBlock label="planos de teste" />;
    }
    if (plansState.error) {
      return <EmptyBlock title="Nao foi possivel carregar os planos" description={plansState.error} />;
    }
    if (filteredPlans.length === 0) {
      return (
        <EmptyBlock
          title="Nenhum plano encontrado"
          description="Selecione outra aplicacao ou aguarde a sincronizacao de planos manuais e integrados."
        />
      );
    }

    return (
      <div className="space-y-3">
        {plansState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {plansState.warning}
          </div>
        ) : null}
        {filteredPlans.slice(0, 24).map((plan) => (
          <div key={plan.id} className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{plan.title}</div>
                <div className="mt-1 text-xs text-white/52">
                  {plan.applicationName ?? "Sem aplicacao"} {plan.projectCode ? `| ${plan.projectCode}` : ""}{" "}
                  {plan.updatedAt ? `| ${formatDateTime(plan.updatedAt, locale)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72">
                  {plan.source}
                </span>
                <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72">
                  {plan.casesCount} casos
                </span>
                {plan.automationCasesCount > 0 ? (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-sky-200">
                    {plan.automationCasesCount} autom.
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderDefectsModule() {
    if (defectsState.loading && defectsState.items.length === 0) {
      return <LoadingBlock label="defeitos" />;
    }
    if (defectsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar os defeitos" description={defectsState.error} />;
    }
    if (filteredDefects.length === 0) {
      return (
        <EmptyBlock
          title="Nenhum defeito encontrado"
          description="Os defeitos abertos e sincronizados da empresa aparecerao aqui."
        />
      );
    }

    return (
      <div className="space-y-3">
        {defectsState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {defectsState.warning}
          </div>
        ) : null}
        {filteredDefects.slice(0, 30).map((defect) => (
          <div key={defect.id} className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{defect.title}</div>
                <div className="mt-1 text-xs text-white/52">
                  {defect.projectCode ?? "Sem projeto"} {defect.runName ? `| ${defect.runName}` : ""}{" "}
                  {defect.openedAt ? `| ${formatDateTime(defect.openedAt, locale)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${defectToneClasses(defect.status)}`}>
                  {defect.status}
                </span>
                {defect.severity ? (
                  <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72">
                    {defect.severity}
                  </span>
                ) : null}
                {defect.externalUrl ? (
                  <a
                    href={defect.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/72 transition hover:border-white/20 hover:bg-white/10"
                  >
                    Abrir <FiExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSupportModule() {
    if (ticketsState.loading && ticketsState.items.length === 0) {
      return <LoadingBlock label="chamados" />;
    }
    if (ticketsState.error) {
      return <EmptyBlock title="Nao foi possivel carregar os chamados" description={ticketsState.error} />;
    }
    if (ticketsState.warning && ticketsState.items.length === 0) {
      return <EmptyBlock title="Chamados seguem o escopo atual" description={ticketsState.warning} />;
    }
    if (ticketsState.items.length === 0) {
      return (
        <EmptyBlock
          title="Nenhum chamado visivel neste recorte"
          description="Os chamados aparecem aqui respeitando o fluxo e o escopo de suporte ja existente."
        />
      );
    }

    return (
      <div className="space-y-3">
        {ticketsState.warning ? (
          <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {ticketsState.warning}
          </div>
        ) : null}
        {ticketsState.items.slice(0, 24).map((ticket) => (
          <div key={ticket.id} className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {ticket.code ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/46">{ticket.code}</span> : null}
                  <span className="text-sm font-semibold text-white">{ticket.title}</span>
                </div>
                <div className="mt-1 text-xs text-white/52">
                  {ticket.assignedToName ? `Responsavel: ${ticket.assignedToName}` : "Sem responsavel"}{" "}
                  {ticket.updatedAt ? `| ${formatDateTime(ticket.updatedAt, locale)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${ticketToneClasses(ticket.status)}`}>
                  {ticket.status}
                </span>
                {ticket.priority ? (
                  <span className={`rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-semibold uppercase tracking-[0.18em] ${priorityToneClasses(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderDashboardModule() {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Runs ativas" value={String(liveRuns.length)} hint="Execucoes em andamento neste instante." />
          <MetricCard label="Pass rate medio" value={formatPercent(averagePassRate)} hint="Media do recorte atual por empresa/aplicacao." />
          <MetricCard label="Defeitos abertos" value={String(openDefects.length)} hint="Itens ainda sem resolucao final." />
          <MetricCard label="Casos executados" value={String(totalExecutedCases)} hint="Total de casos consolidados nas runs filtradas." />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Prioridade</p>
                <h3 className="mt-1 text-lg font-semibold text-white">O que olhar primeiro</h3>
              </div>
              <FiTarget className="h-5 w-5 text-white/40" />
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                <div className="text-sm font-semibold text-white">Runs em andamento</div>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {liveRuns.length > 0
                    ? `${liveRuns.length} execucao(oes) ainda estao rodando para este recorte.`
                    : "Nenhuma execucao em andamento agora."}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                <div className="text-sm font-semibold text-white">Defeitos em aberto</div>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {openDefects.length > 0
                    ? `${openDefects.length} defeito(s) seguem sem fechamento no recorte atual.`
                    : "Nenhum defeito aberto neste recorte."}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-[#0f1b33] px-4 py-3">
                <div className="text-sm font-semibold text-white">Chamados visiveis</div>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {openTickets.length > 0
                    ? `${openTickets.length} chamado(s) ainda pedem resposta ou movimentacao.`
                    : "Nenhum chamado aberto no escopo visivel."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/46">Leitura rapida</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Recorte atual</h3>
              </div>
              <FiTrendingUp className="h-5 w-5 text-white/40" />
            </div>
            <div className="mt-4 space-y-3 text-sm text-white/62">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Aplicacao ativa no recorte</span>
                <strong className="text-white">{selectedApplication?.name ?? "Todas"}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Casos bloqueados</span>
                <strong className="text-white">{totalBlockedCases}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Planos visiveis</span>
                <strong className="text-white">{filteredPlans.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <span>Aplicacoes da empresa</span>
                <strong className="text-white">{applicationsState.items.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMetricsModule() {
    const atRiskRuns = filteredRuns.filter((run) => run.statusKey === "at_risk").length;
    const completedRuns = filteredRuns.filter((run) => run.statusKey === "completed").length;
    const qaseApplications = applicationsState.items.filter((application) => application.qaseProjectCode).length;

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Runs concluidas" value={String(completedRuns)} hint="Historico encerrado no recorte atual." />
          <MetricCard label="Runs em risco" value={String(atRiskRuns)} hint="Falha, abort ou status fora do esperado." />
          <MetricCard label="Aplicacoes Qase" value={String(qaseApplications)} hint="Aplicacoes com projeto integrado e legivel." />
          <MetricCard label="Chamados abertos" value={String(openTickets.length)} hint="Visiveis no escopo do seu perfil." />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-white">
              <FiActivity className="h-5 w-5 text-(--tc-accent,#ef0001)" />
              <h3 className="text-lg font-semibold">Saude da execucao</h3>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Pass rate medio</span>
                <strong className="text-white">{formatPercent(averagePassRate)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Casos executados</span>
                <strong className="text-white">{totalExecutedCases}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Casos bloqueados</span>
                <strong className="text-white">{totalBlockedCases}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Runs ao vivo</span>
                <strong className="text-white">{liveRuns.length}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-white">
              <FiLayers className="h-5 w-5 text-(--tc-accent,#ef0001)" />
              <h3 className="text-lg font-semibold">Cobertura do workspace</h3>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Aplicacoes visiveis</span>
                <strong className="text-white">{applicationsState.items.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Planos visiveis</span>
                <strong className="text-white">{filteredPlans.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Defeitos abertos</span>
                <strong className="text-white">{openDefects.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-sm text-white/64">
                <span>Chamados abertos</span>
                <strong className="text-white">{openTickets.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMainModule() {
    if (!selectedCompanySlug) {
      return (
        <EmptyBlock
          title="Selecione uma empresa para iniciar"
          description="A operacao agora vive em contexto temporario. Voce escolhe empresa e aplicacao sem misturar sua sessao."
        />
      );
    }

    if (selectedModule.key === "dashboard") return renderDashboardModule();
    if (selectedModule.key === "runs") return renderRunsModule();
    if (selectedModule.key === "applications") return renderApplicationsModule();
    if (selectedModule.key === "test-plans") return renderPlansModule();
    if (selectedModule.key === "defects") return renderDefectsModule();
    if (selectedModule.key === "support") return renderSupportModule();
    return renderMetricsModule();
  }

  return (
    <div className="operation-workspace min-h-[calc(100vh-var(--topbar-h))] w-full bg-transparent pb-5 pt-0 text-white">
      <div className="flex w-full max-w-none flex-col gap-4 px-3 sm:px-4 lg:px-5 xl:px-6">
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,17,32,0.96),rgba(13,27,49,0.95))] px-5 py-5 shadow-[0_28px_60px_rgba(1,12,28,0.28)] sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-(--tc-accent,#ef0001)/30 bg-(--tc-accent,#ef0001)/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ffd2d2]">
                  Operacao inteligente
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Sem trocar sessao
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Atualizacao automatica 30s
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Empresa, modulo e aplicacao no mesmo workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62 sm:text-base">
                Aqui a empresa selecionada vira apenas um recorte operacional temporario. A tela renderiza os dados que importam
                dentro de Operacao, sem forcar troca de contexto global e sem misturar sua permissao com a permissao da empresa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRefreshTick((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white/84 transition hover:border-white/20 hover:bg-white/12 hover:text-white"
              >
                <FiRefreshCw className="h-4 w-4" />
                Atualizar dados
              </button>
              {selectedCompanySlug ? (
                <Link
                  href={fullScreenHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-accent,#ef0001)/35 bg-(--tc-accent,#ef0001)/12 px-4 py-2.5 text-sm font-semibold text-[#ffd2d2] transition hover:border-(--tc-accent,#ef0001)/55 hover:bg-(--tc-accent,#ef0001)/18"
                >
                  Abrir tela completa
                  <FiExternalLink className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(240px,0.9fr)_minmax(240px,0.9fr)_minmax(0,1.2fr)]">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Empresa</span>
              <select
                value={selectedCompanySlug ?? ""}
                onChange={(event) => replaceQuery({ companySlug: event.target.value || null, applicationId: null })}
                className="min-h-12 w-full rounded-[20px] border border-white/12 bg-white/6 px-4 text-sm text-white outline-none transition focus:border-(--tc-accent,#ef0001)/60"
              >
                {clients.map((company) => (
                  <option key={company.id} value={company.slug} className="bg-slate-900 text-white">
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/54">Aplicacao</span>
              <select
                value={selectedApplication?.id ?? ""}
                onChange={(event) => replaceQuery({ applicationId: event.target.value || null })}
                className="min-h-12 w-full rounded-[20px] border border-white/12 bg-white/6 px-4 text-sm text-white outline-none transition focus:border-(--tc-accent,#ef0001)/60"
              >
                <option value="" className="bg-slate-900 text-white">
                  Todas as aplicacoes
                </option>
                {applicationsState.items.map((application) => (
                  <option key={application.id} value={application.id} className="bg-slate-900 text-white">
                    {application.name}
                    {application.qaseProjectCode ? ` (${application.qaseProjectCode})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">Empresa ativa no recorte</div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedCompany?.name ?? "Sem empresa"}</div>
                <div className="mt-1 text-xs text-white/52">Este recorte nao altera a sua empresa ativa na sessao.</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">Perfil</div>
                <div className="mt-2 text-sm font-semibold text-white">{user?.permissionRole ?? user?.role ?? "Sem perfil"}</div>
                <div className="mt-1 text-xs text-white/52">As leituras respeitam o escopo de permissao ja existente.</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">Aplicacao do recorte</div>
                <div className="mt-2 text-sm font-semibold text-white">{selectedApplication?.name ?? "Todas"}</div>
                <div className="mt-1 text-xs text-white/52">Use a lista da esquerda para trocar o foco rapidamente.</div>
              </div>
            </div>
          </div>
        </section>

        {clients.length === 0 ? (
          <EmptyBlock
            title="Nenhuma empresa visivel no momento"
            description="Quando houver empresas no seu escopo, o workspace operacional passa a renderizar os modulos desta tela."
          />
        ) : (
          <div className="grid min-h-[calc(100vh-19rem)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,30,0.96),rgba(10,18,32,0.94))] shadow-[0_24px_52px_rgba(1,12,28,0.24)]">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/46">Recorte atual</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{selectedCompany?.name ?? "Selecione uma empresa"}</h2>
                  </div>
                  <span className="rounded-full border border-(--tc-accent,#ef0001)/35 bg-(--tc-accent,#ef0001)/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffd2d2]">
                    {selectedApplication?.qaseProjectCode ?? "global"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/56">
                  Modulos renderizados aqui dentro, com empresa e aplicacao como filtro local.
                </p>
              </div>

              <div className="px-4 py-4">
                <div className="space-y-2">
                  {modules.map((module) => {
                    const isActive = module.key === selectedModule.key;
                    return (
                      <button
                        key={module.key}
                        type="button"
                        onClick={() => replaceQuery({ module: module.key })}
                        className={`flex w-full items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition ${
                          isActive
                            ? "border-(--tc-accent,#ef0001)/55 bg-(--tc-accent,#ef0001)/12 shadow-[0_16px_32px_rgba(239,0,1,0.12)]"
                            : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/7"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border ${isActive ? "border-(--tc-accent,#ef0001)/45 bg-(--tc-accent,#ef0001)/12 text-[#ffd2d2]" : "border-white/10 bg-white/6 text-white/74"}`}>
                          <module.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-white">{module.label}</span>
                            <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/62">
                              {moduleCounts[module.key]}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-white/52">{module.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/46">Aplicacoes no recorte</p>
                    <span className="text-xs text-white/46">{applicationsState.items.length} visiveis</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => replaceQuery({ applicationId: null })}
                      className={`flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                        !selectedApplication
                          ? "border-(--tc-accent,#ef0001)/45 bg-(--tc-accent,#ef0001)/10 text-white"
                          : "border-white/10 bg-white/4 text-white/74 hover:border-white/18 hover:bg-white/8"
                      }`}
                    >
                      <span>Todas as aplicacoes</span>
                      <FiArrowRight className="h-4 w-4" />
                    </button>
                    {applicationsState.items.slice(0, 8).map((application) => {
                      const isActive = selectedApplication?.id === application.id;
                      return (
                        <button
                          key={`aside-${application.id}`}
                          type="button"
                          onClick={() => replaceQuery({ applicationId: isActive ? null : application.id })}
                          className={`flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                            isActive
                              ? "border-(--tc-accent,#ef0001)/45 bg-(--tc-accent,#ef0001)/10 text-white"
                              : "border-white/10 bg-white/4 text-white/74 hover:border-white/18 hover:bg-white/8"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{application.name}</span>
                          <span className="ml-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/46">
                            {application.qaseProjectCode ?? "--"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-4">
              <ModuleSection
                title={selectedModule.label}
                description={selectedModule.description}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                      {selectedCompany?.name ?? "Sem empresa"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                      {selectedApplication?.name ?? "Todas"}
                    </span>
                  </div>
                }
              >
                {renderMainModule()}
              </ModuleSection>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <ModuleSection
                  title="Atalhos da empresa"
                  description="Se precisar aprofundar, daqui voce abre a tela completa ja no contexto certo."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {modules.map((module) => (
                      <Link
                        key={`shortcut-${module.key}`}
                        href={selectedCompanySlug ? buildCompanyPathForAccess(selectedCompanySlug, module.route, companyRouteInput) : "/operacao"}
                        className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/4 px-4 py-4 text-sm font-semibold text-white/82 transition hover:border-white/20 hover:bg-white/8 hover:text-white"
                      >
                        <span className="inline-flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-white/6">
                            <module.icon className="h-4 w-4" />
                          </span>
                          {module.label}
                        </span>
                        <FiExternalLink className="h-4 w-4 text-white/40" />
                      </Link>
                    ))}
                  </div>
                </ModuleSection>

                <ModuleSection
                  title="Estado do workspace"
                  description="Leituras auxiliares para entender o que carregou e o que ainda depende de integracao."
                >
                  <div className="space-y-3 text-sm text-white/62">
                    {[
                      {
                        label: "Aplicacoes",
                        loading: applicationsState.loading,
                        error: applicationsState.error,
                        warning: applicationsState.warning,
                        updatedAt: applicationsState.updatedAt,
                      },
                      {
                        label: "Runs",
                        loading: runsState.loading,
                        error: runsState.error,
                        warning: runsState.warning,
                        updatedAt: runsState.updatedAt,
                      },
                      {
                        label: "Planos",
                        loading: plansState.loading,
                        error: plansState.error,
                        warning: plansState.warning,
                        updatedAt: plansState.updatedAt,
                      },
                      {
                        label: "Defeitos",
                        loading: defectsState.loading,
                        error: defectsState.error,
                        warning: defectsState.warning,
                        updatedAt: defectsState.updatedAt,
                      },
                      {
                        label: "Chamados",
                        loading: ticketsState.loading,
                        error: ticketsState.error,
                        warning: ticketsState.warning,
                        updatedAt: ticketsState.updatedAt,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[20px] border border-white/10 bg-white/4 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-white">{item.label}</span>
                          <span className="text-xs text-white/50">
                            {item.loading
                              ? "Sincronizando"
                              : item.updatedAt
                                ? formatDateTime(new Date(item.updatedAt).toISOString(), locale)
                                : "Sem sincronizacao"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-white/56">
                          {item.error ?? item.warning ?? "Leitura pronta para este bloco."}
                        </div>
                      </div>
                    ))}
                  </div>
                </ModuleSection>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
