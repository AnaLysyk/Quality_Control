import "server-only";

export type QaEntityKind =
  | "company"
  | "project"
  | "repository"
  | "flow"
  | "test_case"
  | "data_element"
  | "test_plan"
  | "run"
  | "run_item"
  | "automation_script"
  | "defect"
  | "note"
  | "evidence"
  | "metric"
  | "brian";

export type AutomationStatus = "manual" | "automation_candidate" | "automated" | "automation_outdated" | "quarantined";
export type ExecutionType = "manual" | "automated" | "assisted_by_brian";
export type RunStatus = "draft" | "scheduled" | "in_progress" | "completed" | "cancelled";
export type RunItemStatus = "not_run" | "passed" | "failed" | "blocked" | "skipped";

export type QaOperationStep = {
  id: string;
  title: string;
  kind: QaEntityKind;
  description: string;
  required: boolean;
  emptyState: string;
  routes: string[];
  owns: string[];
  rules: string[];
};

export type QaMetricDefinition = {
  id: string;
  label: string;
  scope: "project" | "person" | "automation" | "plan" | "run" | "defect";
  description: string;
  formula: string;
  source: string[];
};

export type BrianOperationCommand = {
  id: string;
  label: string;
  intent: string;
  example: string;
  requiredContext: string[];
  actions: string[];
  guardrails: string[];
};

export type QaImplementationBacklogItem = {
  id: string;
  title: string;
  area: "project" | "repository" | "plan" | "run" | "automation" | "metrics" | "notes" | "brian";
  priority: "critical" | "high" | "medium";
  status: "ready" | "next" | "later";
  acceptanceCriteria: string[];
};

export const qaOperationHierarchy: QaOperationStep[] = [
  {
    id: "company",
    title: "Empresa",
    kind: "company",
    description: "Agrupa clientes, usuarios, projetos, permissoes e visao executiva.",
    required: true,
    emptyState: "Empresa criada sem projeto ainda.",
    routes: ["/admin/clients", "/empresas/[slug]"],
    owns: ["project", "users", "permissions", "dashboard"],
    rules: ["Toda informacao operacional precisa manter companyId/companySlug.", "Dashboard global nao pode misturar empresas sem permissao ampla."],
  },
  {
    id: "project",
    title: "Projeto",
    kind: "project",
    description: "Unidade de trabalho de QA. Ao nascer, cria estrutura operacional vazia.",
    required: true,
    emptyState: "Projeto sem casos, planos, runs, automacao ou defeitos.",
    routes: ["/empresas/[slug]", "/central-de-qualidade"],
    owns: ["repository", "flows", "data_elements", "plans", "runs", "automation", "defects", "metrics", "brian_context"],
    rules: [
      "Todo projeto deve aparecer no topo da operacao por projeto.",
      "Criar projeto deve inicializar repositorio de casos, planos, execucoes, automacao, defeitos e metricas zeradas.",
      "Tudo que Brian fizer precisa carregar projectId e companyId.",
    ],
  },
  {
    id: "repository",
    title: "Repositorio de Casos",
    kind: "repository",
    description: "Fonte oficial dos casos do projeto. Planos e automacao devem consumir daqui.",
    required: true,
    emptyState: "Repositorio vazio: nenhum caso criado para o projeto.",
    routes: ["/casos-de-teste", "/empresas/[slug]/casos-de-teste"],
    owns: ["test_case", "steps", "data_elements", "automation_status", "case_history"],
    rules: [
      "Caso de teste pertence a um projeto.",
      "Plano de teste so pode usar casos do repositorio do mesmo projeto.",
      "Caso automatizado precisa manter vinculo com script ou suite tecnica.",
    ],
  },
  {
    id: "test-case",
    title: "Caso de Teste",
    kind: "test_case",
    description: "Unidade verificavel com passos, esperado, dados, status de automacao e historico.",
    required: true,
    emptyState: "Sem casos cadastrados.",
    routes: ["/casos-de-teste", "/automacoes/casos"],
    owns: ["steps", "automation_link", "notes", "evidence", "defects"],
    rules: [
      "Status de automacao permitido: manual, automation_candidate, automated, automation_outdated, quarantined.",
      "Caso candidato deve aparecer na fila de automacao.",
      "Caso alterado depois do script deve virar automation_outdated ate revisao.",
    ],
  },
  {
    id: "test-plan",
    title: "Plano de Teste",
    kind: "test_plan",
    description: "Seleciona casos do repositorio para uma release, ciclo, regressao ou validacao.",
    required: true,
    emptyState: "Sem plano criado para o projeto.",
    routes: ["/empresas/[slug]/planos-de-teste"],
    owns: ["plan_cases", "snapshot", "coverage", "runs"],
    rules: [
      "Plano so aceita casos do mesmo projectId.",
      "Plano precisa guardar snapshot/versionamento minimo dos casos selecionados.",
      "Run so pode nascer a partir de um plano.",
    ],
  },
  {
    id: "run",
    title: "Run / Execucao",
    kind: "run",
    description: "Execucao de um plano com responsavel, itens, tempo, status e evidencias.",
    required: true,
    emptyState: "Sem execucao criada. Crie um plano antes de executar.",
    routes: ["/empresas/[slug]/runs", "/runs", "/automacoes/execucoes"],
    owns: ["run_items", "assignees", "duration", "results", "defects", "evidence"],
    rules: [
      "Run sem planId deve ser bloqueada.",
      "Cada caso do plano vira um run item.",
      "Run item precisa registrar responsavel, status, inicio, fim, duracao e evidencia quando houver falha.",
    ],
  },
  {
    id: "automation",
    title: "Automacao",
    kind: "automation_script",
    description: "Fila e vinculo entre casos e scripts automatizados.",
    required: false,
    emptyState: "Sem candidatos a automacao e sem scripts vinculados.",
    routes: ["/automacoes", "/automacoes/casos", "/automacoes/execucoes"],
    owns: ["script_link", "framework", "command", "last_result", "flaky_status"],
    rules: [
      "Automacao consome casos candidatos ou automatizados do repositorio.",
      "Resultado automatizado precisa voltar para run item quando executar dentro de uma run.",
      "Script sem caso vinculado deve aparecer como pendencia de organizacao.",
    ],
  },
  {
    id: "metrics",
    title: "Metricas",
    kind: "metric",
    description: "Numeros gerados automaticamente a partir de casos, planos, runs, defeitos, notas e automacao.",
    required: true,
    emptyState: "Metricas zeradas ate existir caso, plano, run ou defeito.",
    routes: ["/central-de-qualidade", "/metrics", "/dashboard"],
    owns: ["project_metrics", "person_metrics", "automation_metrics", "health_score"],
    rules: ["Metrica nao deve ser preenchida manualmente.", "Toda metrica precisa apontar fonte de dados.", "Dashboard deve permitir recorte por projeto, pessoa e periodo."],
  },
  {
    id: "brian",
    title: "Brian",
    kind: "brian",
    description: "Agente operacional que consulta e executa as mesmas acoes manuais com trilha de auditoria.",
    required: true,
    emptyState: "Brian com contexto do projeto, aguardando dados para operar.",
    routes: ["/brain", "/chat", "/api/brain/commands"],
    owns: ["commands", "audit", "suggestions", "summaries"],
    rules: [
      "Toda acao do Brian precisa ter ator, contexto, entidade e auditoria.",
      "Brian deve perguntar quando houver mais de uma opcao possivel.",
      "Brian nao pode marcar sucesso sem registrar resultado no run item.",
    ],
  },
];

export const automationStatusFlow: Array<{ status: AutomationStatus; label: string; meaning: string; visibleInAutomation: boolean }> = [
  { status: "manual", label: "Manual", meaning: "Caso executado apenas manualmente.", visibleInAutomation: false },
  { status: "automation_candidate", label: "Candidato a automacao", meaning: "Caso deve aparecer na fila da automacao.", visibleInAutomation: true },
  { status: "automated", label: "Automatizado", meaning: "Caso possui script vinculado e pode alimentar execucoes automatizadas.", visibleInAutomation: true },
  { status: "automation_outdated", label: "Automacao desatualizada", meaning: "Caso mudou ou falhou por manutencao e precisa revisar script.", visibleInAutomation: true },
  { status: "quarantined", label: "Quarentena", meaning: "Script instavel ou flaky, fora da metrica principal ate estabilizar.", visibleInAutomation: true },
];

export const runLifecycle = [
  "Criar plano com casos do repositorio do projeto.",
  "Criar run obrigatoriamente a partir do plano.",
  "Gerar run items para cada caso do plano.",
  "Atribuir responsavel por run ou por item.",
  "Registrar inicio e fim por item.",
  "Calcular duracao automaticamente.",
  "Registrar status: passed, failed, blocked, skipped ou not_run.",
  "Obrigar evidencia ou nota quando status for failed ou blocked.",
  "Permitir criar defeito a partir do run item.",
  "Atualizar dashboard do projeto, pessoa, plano e automacao.",
];

export const qaMetricDefinitions: QaMetricDefinition[] = [
  { id: "project-test-cases-total", label: "Casos do projeto", scope: "project", description: "Quantidade total de casos ativos no repositorio do projeto.", formula: "count(test_cases where projectId = currentProject and status != archived)", source: ["test_cases"] },
  { id: "project-plan-coverage", label: "Cobertura por plano", scope: "project", description: "Percentual de casos do repositorio cobertos por planos ativos.", formula: "unique(plan_cases.caseId) / active_test_cases", source: ["test_plans", "plan_cases", "test_cases"] },
  { id: "project-automation-coverage", label: "Cobertura automatizada", scope: "automation", description: "Percentual de casos ativos com automacao valida.", formula: "automated_cases / active_test_cases", source: ["test_cases", "automation_scripts"] },
  { id: "run-pass-rate", label: "Taxa de aprovacao", scope: "run", description: "Percentual de itens aprovados na run.", formula: "passed_run_items / executed_run_items", source: ["runs", "run_items"] },
  { id: "run-fail-rate", label: "Taxa de reprovacao", scope: "run", description: "Percentual de itens reprovados na run.", formula: "failed_run_items / executed_run_items", source: ["runs", "run_items"] },
  { id: "person-execution-time", label: "Tempo por pessoa", scope: "person", description: "Tempo total executado por responsavel no periodo.", formula: "sum(run_items.durationSeconds grouped by assigneeId)", source: ["run_items", "users"] },
  { id: "person-productivity", label: "Produtividade por pessoa", scope: "person", description: "Quantidade de itens executados por pessoa e tempo medio por item.", formula: "count(executed_run_items) and avg(durationSeconds) grouped by assigneeId", source: ["run_items", "users"] },
  { id: "defect-density", label: "Defeitos por execucao", scope: "defect", description: "Volume de defeitos gerados por run, plano ou projeto.", formula: "count(defects linked to run_items) grouped by projectId/planId/runId", source: ["defects", "run_items"] },
  { id: "notes-converted", label: "Notas convertidas", scope: "project", description: "Notas que viraram defeito, caso, evidencia ou acao.", formula: "count(notes where convertedToAction = true) / count(notes)", source: ["notes", "defects", "test_cases", "evidence"] },
  { id: "project-health-score", label: "Health Score", scope: "project", description: "Indice executivo combinando cobertura, aprovacao, defeitos, bloqueios e automacao.", formula: "weighted(coverage, passRate, openDefects, blockedRate, automationCoverage)", source: ["test_cases", "test_plans", "run_items", "defects", "automation_scripts"] },
];

export const brianOperationCommands: BrianOperationCommand[] = [
  {
    id: "brian-create-project-structure",
    label: "Criar estrutura do projeto",
    intent: "Inicializar repositorio, planos, runs, automacao, defeitos, metricas e contexto do Brian quando um projeto nasce.",
    example: "Brian, cria a estrutura de QA para o projeto Cidadao Smart.",
    requiredContext: ["companyId", "projectName", "actorId"],
    actions: ["create_project_shell", "create_case_repository", "create_empty_dashboards", "register_brian_context"],
    guardrails: ["Confirmar empresa quando houver mais de uma.", "Nao duplicar estrutura se o projeto ja existir."],
  },
  {
    id: "brian-mark-run-item",
    label: "Marcar resultado de caso",
    intent: "Permitir que o usuario aprove, reprove, bloqueie ou pule um caso dentro de uma run.",
    example: "Brian, reprova o teste de login da run de regressao.",
    requiredContext: ["projectId", "runId", "caseId", "status", "actorId"],
    actions: ["search_case", "disambiguate_case", "update_run_item", "record_note", "suggest_defect"],
    guardrails: ["Perguntar qual caso quando houver mais de uma opcao.", "Exigir motivo/evidencia para failed ou blocked.", "Registrar duracao e responsavel."],
  },
  {
    id: "brian-link-automation",
    label: "Vincular script ao caso",
    intent: "Conectar um caso candidato a automacao com script Playwright/API e mudar status para automatizado.",
    example: "Brian, vincula esse caso ao script tests/login.spec.ts.",
    requiredContext: ["projectId", "caseId", "scriptPath", "framework", "actorId"],
    actions: ["validate_case", "validate_script_reference", "create_automation_link", "update_automation_status"],
    guardrails: ["Nao automatizar caso sem passos e esperado.", "Registrar script sem executar se nao houver runner disponivel."],
  },
  {
    id: "brian-generate-dashboard-summary",
    label: "Gerar resumo executivo",
    intent: "Explicar numeros do projeto com base em casos, runs, pessoas, defeitos, notas e automacao.",
    example: "Brian, resume a saude do projeto essa semana.",
    requiredContext: ["projectId", "period", "actorId"],
    actions: ["load_metrics", "identify_risks", "summarize_findings", "suggest_actions"],
    guardrails: ["Separar dado real de inferencia.", "Apontar metricas sem fonte suficiente."],
  },
];

export const qaImplementationBacklog: QaImplementationBacklogItem[] = [
  {
    id: "qa-project-shell",
    title: "Criar estrutura operacional vazia ao criar projeto",
    area: "project",
    priority: "critical",
    status: "ready",
    acceptanceCriteria: ["Ao criar projeto, criar repositorio de casos vazio.", "Criar areas vazias de planos, runs, automacao, defeitos e metricas.", "Projeto novo deve aparecer no topo da operacao por projeto."],
  },
  {
    id: "qa-case-repository-project-scope",
    title: "Garantir repositorio de casos por projeto",
    area: "repository",
    priority: "critical",
    status: "ready",
    acceptanceCriteria: ["Caso sempre possui projectId e companyId.", "Tela de casos filtra pelo projeto atual.", "Plano nao enxerga caso de outro projeto."],
  },
  {
    id: "qa-case-automation-status",
    title: "Adicionar status de automacao no caso",
    area: "automation",
    priority: "high",
    status: "ready",
    acceptanceCriteria: ["Caso pode ser manual, candidato, automatizado, desatualizado ou quarentena.", "Candidato aparece na fila da automacao.", "Automatizado exige vinculo com script."],
  },
  {
    id: "qa-plan-from-repository",
    title: "Plano puxar casos somente do repositorio do projeto",
    area: "plan",
    priority: "critical",
    status: "ready",
    acceptanceCriteria: ["Criacao de plano lista apenas casos do projeto.", "Plano salva snapshot dos casos selecionados.", "Plano exibe cobertura sobre o repositorio."],
  },
  {
    id: "qa-run-plan-required",
    title: "Bloquear run sem plano de teste",
    area: "run",
    priority: "critical",
    status: "ready",
    acceptanceCriteria: ["API rejeita run sem planId.", "UI exige plano antes de criar run.", "Run gera itens com base nos casos do plano."],
  },
  {
    id: "qa-run-item-time-assignee",
    title: "Registrar responsavel, status e tempo por item executado",
    area: "run",
    priority: "critical",
    status: "ready",
    acceptanceCriteria: ["Run item tem assigneeId e executorId.", "Inicio/fim calculam durationSeconds.", "Failed/blocked exigem nota ou evidencia."],
  },
  {
    id: "qa-person-project-metrics",
    title: "Gerar metricas por projeto e pessoa",
    area: "metrics",
    priority: "high",
    status: "next",
    acceptanceCriteria: ["Dashboard mostra casos executados por pessoa.", "Dashboard mostra tempo total e medio por pessoa.", "Dashboard mostra taxa de aprovacao e falha por projeto."],
  },
  {
    id: "qa-notes-as-data",
    title: "Transformar notas em informacao operacional",
    area: "notes",
    priority: "high",
    status: "next",
    acceptanceCriteria: ["Nota tem entityType e entityId.", "Nota pode virar defeito, caso ou evidencia.", "Dashboard conta notas bloqueantes e convertidas."],
  },
  {
    id: "qa-brian-operates-runs",
    title: "Brian operar casos, planos e runs por comando",
    area: "brian",
    priority: "critical",
    status: "next",
    acceptanceCriteria: ["Brian consulta casos por projeto.", "Brian pergunta qual caso quando houver ambiguidade.", "Brian marca passed/failed/blocked em run item com auditoria."],
  },
];

export function getQaOperationModel() {
  return {
    generatedAt: new Date().toISOString(),
    hierarchy: qaOperationHierarchy,
    automationStatusFlow,
    runLifecycle,
    metrics: qaMetricDefinitions,
    brianCommands: brianOperationCommands,
    backlog: qaImplementationBacklog,
    summary: {
      hierarchyItems: qaOperationHierarchy.length,
      metrics: qaMetricDefinitions.length,
      brianCommands: brianOperationCommands.length,
      backlogItems: qaImplementationBacklog.length,
      criticalBacklog: qaImplementationBacklog.filter((item) => item.priority === "critical").length,
      readyBacklog: qaImplementationBacklog.filter((item) => item.status === "ready").length,
    },
  };
}
