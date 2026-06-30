import "server-only";

export type TestRunType = "manual" | "automated" | "hybrid" | "assisted_by_brian";
export type TestRunStatus = "draft" | "scheduled" | "in_progress" | "paused" | "completed" | "cancelled" | "aborted";
export type TestRunSource = "local" | "qase" | "playwright" | "brian" | "import";
export type TestRunItemStatus = "not_run" | "in_progress" | "passed" | "failed" | "blocked" | "skipped" | "retest";
export type TestRunExecutionType = "manual" | "automated" | "assisted_by_brian";
export type QaseResultSyncStatus = "pending" | "synced" | "failed" | "skipped";
export type EvidenceType = "image" | "video" | "log" | "file" | "link" | "text" | "api_response" | "console" | "trace";

export type RunFieldDefinition = {
  key: string;
  label: string;
  required: boolean;
  description: string;
};

export type RunActionDefinition = {
  id: string;
  label: string;
  entity: "run" | "run_item" | "attempt" | "evidence" | "defect" | "qase" | "brian";
  description: string;
  requiredContext: string[];
  validations: string[];
  sideEffects: string[];
};

export type RunRuleDefinition = {
  id: string;
  priority: "critical" | "high" | "medium";
  entity: "repository" | "plan" | "run" | "run_item" | "attempt" | "evidence" | "defect" | "qase" | "brian";
  rule: string;
  acceptanceCriteria: string[];
};

export type RunScreenSection = {
  id: string;
  title: string;
  purpose: string;
  mustShow: string[];
  actions: string[];
};

export type BrianRunCommand = {
  id: string;
  label: string;
  example: string;
  requiredContext: string[];
  expectedBehavior: string[];
  guardrails: string[];
};

export const testRunFields: RunFieldDefinition[] = [
  { key: "runId", label: "ID da Run", required: true, description: "Identificador interno da execucao local." },
  { key: "companyId", label: "Empresa", required: true, description: "Escopo de empresa para permissao, dashboard e auditoria." },
  { key: "projectId", label: "Projeto", required: true, description: "Projeto dono do repositorio, plano e execucao." },
  { key: "planId", label: "Plano origem", required: true, description: "Run sempre nasce de um plano aprovado ou pronto." },
  { key: "planSnapshotId", label: "Snapshot do plano", required: true, description: "Congela os casos e versoes usados na criacao da run." },
  { key: "title", label: "Nome da Run", required: true, description: "Nome operacional visivel no dashboard e relatorio." },
  { key: "runType", label: "Tipo", required: true, description: "manual, automated, hybrid ou assisted_by_brian." },
  { key: "status", label: "Status", required: true, description: "draft, scheduled, in_progress, paused, completed, cancelled ou aborted." },
  { key: "source", label: "Origem", required: true, description: "local, qase, playwright, brian ou import." },
  { key: "environment", label: "Ambiente", required: false, description: "Homologacao, producao, staging, ambiente de cliente ou equivalente." },
  { key: "buildVersion", label: "Build/versao", required: false, description: "Versao executada para rastrear regressao e release." },
  { key: "runOwnerId", label: "Responsavel", required: true, description: "Pessoa responsavel pela execucao completa." },
  { key: "startedAt", label: "Inicio", required: false, description: "Quando a run entrou em execucao." },
  { key: "finishedAt", label: "Fim", required: false, description: "Quando a run foi concluida, cancelada ou abortada." },
  { key: "qaseRunId", label: "Qase Run", required: false, description: "Identificador da run no Qase quando houver sincronizacao." },
];

export const testRunItemFields: RunFieldDefinition[] = [
  { key: "runItemId", label: "ID do item", required: true, description: "Identificador interno do item executavel." },
  { key: "runId", label: "Run", required: true, description: "Run dona do item." },
  { key: "caseId", label: "Caso", required: true, description: "Caso de teste do repositorio." },
  { key: "caseVersion", label: "Versao do caso", required: true, description: "Versao congelada no snapshot do plano." },
  { key: "caseKey", label: "Chave do caso", required: true, description: "Chave legivel para busca e relatorio." },
  { key: "caseTitle", label: "Titulo do caso", required: true, description: "Titulo congelado no momento da run." },
  { key: "suitePath", label: "Suite/modulo", required: false, description: "Caminho do caso dentro do repositorio." },
  { key: "assigneeId", label: "Responsavel", required: false, description: "Pessoa atribuida para executar o item." },
  { key: "executorId", label: "Executor", required: false, description: "Pessoa ou agente que realmente executou." },
  { key: "status", label: "Status", required: true, description: "not_run, in_progress, passed, failed, blocked, skipped ou retest." },
  { key: "attemptNumber", label: "Tentativa", required: true, description: "Numero da tentativa atual." },
  { key: "durationSeconds", label: "Duracao", required: false, description: "Tempo real de execucao do item." },
  { key: "actualResult", label: "Resultado atual", required: false, description: "Obrigatorio para falha quando nao houver evidencia suficiente." },
  { key: "failureReason", label: "Motivo da falha", required: false, description: "Obrigatorio para status failed." },
  { key: "blockedReason", label: "Motivo do bloqueio", required: false, description: "Obrigatorio para status blocked." },
  { key: "evidenceIds", label: "Evidencias", required: false, description: "Arquivos, links, logs, videos, traces ou respostas de API." },
  { key: "defectId", label: "Defeito", required: false, description: "Defeito criado ou vinculado a partir do item." },
  { key: "qaseResultId", label: "Qase Result", required: false, description: "Resultado enviado ao Qase quando sync estiver ativo." },
  { key: "qaseSyncStatus", label: "Sync Qase", required: false, description: "pending, synced, failed ou skipped." },
];

export const runActions: RunActionDefinition[] = [
  {
    id: "create-run-from-plan",
    label: "Criar Run a partir de plano",
    entity: "run",
    description: "Gera uma execucao local com base no snapshot dos casos do plano.",
    requiredContext: ["companyId", "projectId", "planId", "actorId"],
    validations: ["Plano pertence ao projeto.", "Plano possui casos selecionados.", "Plano nao esta arquivado.", "Usuario pode criar run."],
    sideEffects: ["Criar TestRun.", "Criar TestPlanSnapshot se necessario.", "Criar TestRunItem para cada caso do plano.", "Registrar auditoria.", "Opcionalmente criar Qase Run."],
  },
  {
    id: "start-run",
    label: "Iniciar Run",
    entity: "run",
    description: "Move a run para in_progress e registra horario de inicio.",
    requiredContext: ["runId", "actorId"],
    validations: ["Run esta draft, scheduled ou paused.", "Run possui itens.", "Usuario pode executar."],
    sideEffects: ["Atualizar status.", "Registrar startedAt.", "Registrar auditoria.", "Atualizar dashboard."],
  },
  {
    id: "mark-run-item-result",
    label: "Marcar resultado do item",
    entity: "run_item",
    description: "Atualiza status, responsavel, tempo, tentativa e evidencias do item.",
    requiredContext: ["runId", "runItemId", "status", "actorId"],
    validations: ["Run esta in_progress ou paused com permissao.", "Status failed exige motivo, resultado atual ou evidencia.", "Status blocked exige motivo.", "Status skipped exige motivo quando obrigatorio."],
    sideEffects: ["Atualizar TestRunItem.", "Criar RunItemAttempt.", "Atualizar metricas.", "Sugerir defeito quando failed.", "Enviar resultado ao Qase se sync ativo."],
  },
  {
    id: "create-defect-from-run-item",
    label: "Criar defeito da falha",
    entity: "defect",
    description: "Abre defeito ja preenchido com contexto do caso, run, plano, ambiente e evidencia.",
    requiredContext: ["runId", "runItemId", "actorId"],
    validations: ["Item esta failed, blocked ou retest.", "Existe resultado atual, motivo ou evidencia.", "Usuario pode criar defeito."],
    sideEffects: ["Criar defect.", "Vincular ao run item.", "Reutilizar evidencias.", "Atualizar dashboard.", "Opcionalmente sincronizar com Qase."],
  },
  {
    id: "finish-run",
    label: "Finalizar Run",
    entity: "run",
    description: "Conclui a execucao e congela resumo executivo.",
    requiredContext: ["runId", "actorId"],
    validations: ["Itens obrigatorios nao podem ficar not_run sem justificativa.", "Itens failed sem defeito devem aparecer como risco.", "Run possui resumo calculado."],
    sideEffects: ["Atualizar status para completed.", "Registrar finishedAt.", "Calcular resumo.", "Atualizar metricas.", "Sincronizar pendencias Qase."],
  },
  {
    id: "resync-qase-results",
    label: "Reenviar resultados ao Qase",
    entity: "qase",
    description: "Reprocessa itens com qaseSyncStatus failed ou pending.",
    requiredContext: ["runId", "actorId"],
    validations: ["Empresa possui Qase configurado.", "qaseSyncMode permite envio.", "Run possui qaseRunId ou pode criar Qase Run."],
    sideEffects: ["Enviar resultados pendentes.", "Atualizar qaseResultId.", "Registrar erros por item.", "Criar auditoria de sync."],
  },
];

export const runRules: RunRuleDefinition[] = [
  {
    id: "run-plan-required",
    priority: "critical",
    entity: "run",
    rule: "Run nao pode ser criada sem planId e planSnapshotId.",
    acceptanceCriteria: ["API local rejeita run sem planId.", "UI so permite criar run dentro de um plano.", "Run guarda snapshot usado na criacao."],
  },
  {
    id: "run-item-from-plan-case",
    priority: "critical",
    entity: "run_item",
    rule: "Cada caso obrigatorio do plano gera exatamente um run item inicial.",
    acceptanceCriteria: ["Quantidade de itens bate com casos do snapshot.", "Item guarda caseVersion.", "Item guarda suitePath e ordem do plano."],
  },
  {
    id: "failed-blocked-require-context",
    priority: "critical",
    entity: "run_item",
    rule: "Falha e bloqueio precisam de contexto minimo.",
    acceptanceCriteria: ["Failed exige motivo, resultado atual ou evidencia.", "Blocked exige motivo.", "Skipped em item obrigatorio exige justificativa."],
  },
  {
    id: "attempt-history-required",
    priority: "high",
    entity: "attempt",
    rule: "Toda mudanca executavel relevante cria tentativa/historico.",
    acceptanceCriteria: ["Reteste preserva tentativa anterior.", "Historico mostra executor e duracao.", "Run item aponta para lastAttemptId."],
  },
  {
    id: "evidence-reusable",
    priority: "high",
    entity: "evidence",
    rule: "Evidencia precisa ser entidade reutilizavel por run item, defeito, relatorio, Brian e Qase.",
    acceptanceCriteria: ["Evidence possui companyId/projectId/runId/runItemId.", "Defeito herda evidenceIds.", "Relatorio consegue listar evidencias da run."],
  },
  {
    id: "qase-is-adapter-not-source",
    priority: "critical",
    entity: "qase",
    rule: "Qase e integracao externa; a fonte operacional da run deve ser local.",
    acceptanceCriteria: ["/api/quality/runs cria run local.", "/api/v1/runs atua como adaptador Qase.", "Run local guarda qaseRunId e qaseResultId quando houver sync."],
  },
  {
    id: "brian-cannot-fake-success",
    priority: "critical",
    entity: "brian",
    rule: "Brian nao pode marcar sucesso sem atualizar run item e auditoria.",
    acceptanceCriteria: ["Comando do Brian chama endpoint de resultado.", "Resposta do Brian mostra impacto em metricas.", "Falha/bloqueio via Brian exige motivo/evidencia."],
  },
];

export const runScreenSections: RunScreenSection[] = [
  {
    id: "overview",
    title: "Visao geral",
    purpose: "Mostrar saude da execucao, risco e progresso.",
    mustShow: ["Plano origem", "Projeto", "Ambiente", "Build", "Responsavel", "Status", "Progresso", "Pass rate", "Tempo estimado x real", "Risco da release"],
    actions: ["Iniciar", "Pausar", "Retomar", "Finalizar", "Cancelar", "Exportar relatorio"],
  },
  {
    id: "items",
    title: "Itens da execucao",
    purpose: "Executar e auditar cada caso do plano.",
    mustShow: ["Ordem", "Caso", "Suite/modulo", "Prioridade", "Responsavel", "Status", "Tempo", "Defeito", "Evidencia", "Acoes"],
    actions: ["Marcar passed", "Marcar failed", "Marcar blocked", "Marcar skipped", "Enviar reteste", "Adicionar evidencia", "Criar defeito"],
  },
  {
    id: "evidence",
    title: "Evidencias",
    purpose: "Concentrar provas da execucao.",
    mustShow: ["Imagem", "Video", "Log", "API response", "Trace", "Arquivo", "Link", "Texto"],
    actions: ["Adicionar evidencia", "Vincular ao defeito", "Exportar evidencia"],
  },
  {
    id: "defects",
    title: "Defeitos",
    purpose: "Mostrar defeitos gerados ou vinculados pela run.",
    mustShow: ["Defeitos gerados", "Falhas sem defeito", "Defeitos sem evidencia", "Status dos defeitos"],
    actions: ["Criar defeito", "Vincular defeito", "Abrir kanban", "Cobrar responsavel"],
  },
  {
    id: "history",
    title: "Historico",
    purpose: "Auditoria completa da execucao.",
    mustShow: ["Timeline", "Alteracoes de status", "Tentativas", "Evidencias adicionadas", "Reabertura", "Finalizacao"],
    actions: ["Filtrar por pessoa", "Filtrar por item", "Exportar auditoria"],
  },
  {
    id: "qase",
    title: "Qase",
    purpose: "Controlar sincronizacao externa sem perder fonte local.",
    mustShow: ["Qase project", "Qase run id", "Sync mode", "Sync status", "Itens pendentes", "Erros", "Ultimo sync"],
    actions: ["Criar Qase Run", "Reenviar pendentes", "Abrir no Qase", "Marcar sync como skipped"],
  },
];

export const brianRunCommands: BrianRunCommand[] = [
  {
    id: "brian-create-run-from-plan",
    label: "Criar run do plano",
    example: "Brian, cria uma run do plano Regressao 2.3 para homologacao.",
    requiredContext: ["companyId", "projectId", "planId", "actorId"],
    expectedBehavior: ["Localizar plano.", "Confirmar ambiente/build quando ausente.", "Criar run local com itens do snapshot.", "Explicar total de casos e tempo estimado."],
    guardrails: ["Nao criar run sem plano.", "Perguntar quando houver mais de um plano com nome parecido."],
  },
  {
    id: "brian-mark-item-failed",
    label: "Reprovar item da run",
    example: "Brian, reprova o caso de login nessa run porque retornou 500.",
    requiredContext: ["runId", "caseId ou runItemId", "failureReason", "actorId"],
    expectedBehavior: ["Localizar item.", "Registrar failed.", "Criar tentativa.", "Sugerir defeito.", "Atualizar resumo da run."],
    guardrails: ["Exigir motivo/evidencia.", "Perguntar caso quando houver ambiguidade."],
  },
  {
    id: "brian-run-summary",
    label: "Resumo da run",
    example: "Brian, resume essa run e diz o que falta para finalizar.",
    requiredContext: ["runId", "actorId"],
    expectedBehavior: ["Calcular progresso.", "Listar falhas, bloqueios, pendencias e riscos.", "Apontar falhas sem defeito e itens sem evidencia."],
    guardrails: ["Separar dado real de inferencia.", "Nao dizer que esta pronto se houver item obrigatorio not_run."],
  },
  {
    id: "brian-resync-qase",
    label: "Reenviar resultados ao Qase",
    example: "Brian, reenvia para o Qase os resultados pendentes dessa run.",
    requiredContext: ["runId", "actorId"],
    expectedBehavior: ["Verificar politica Qase.", "Reenviar pendentes/falhos.", "Mostrar sucessos e erros por item."],
    guardrails: ["Nao enviar se empresa nao autorizou sync.", "Nao ocultar erro upstream."],
  },
];

export const runImplementationBacklog = [
  {
    id: "run-local-store",
    title: "Criar store local de TestRun e TestRunItem",
    priority: "critical",
    acceptanceCriteria: ["Run local persiste companyId/projectId/planId.", "Run items sao gerados a partir do snapshot.", "Resumo calculado retorna junto da run."],
  },
  {
    id: "run-result-endpoint",
    title: "Criar endpoint de resultado por item",
    priority: "critical",
    acceptanceCriteria: ["PATCH atualiza status do item.", "Failed/blocked validam motivo/evidencia.", "Cria RunItemAttempt e atualiza metricas."],
  },
  {
    id: "run-detail-screen",
    title: "Criar tela detalhada da Run",
    priority: "critical",
    acceptanceCriteria: ["Tela possui abas overview, itens, evidencias, defeitos, historico e Qase.", "Item abre painel lateral.", "Execucao inline funciona."],
  },
  {
    id: "qase-sync-per-item",
    title: "Sincronizar resultado por item com Qase",
    priority: "high",
    acceptanceCriteria: ["Item guarda qaseSyncStatus.", "Erro de sync aparece na aba Qase.", "Permite reenviar falhas."],
  },
  {
    id: "brian-run-commands",
    title: "Brian operar Run local",
    priority: "high",
    acceptanceCriteria: ["Brian cria run a partir de plano.", "Brian marca item com validacao.", "Brian resume pendencias e riscos."],
  },
];

export function getRunOperationModel() {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      runFields: testRunFields.length,
      runItemFields: testRunItemFields.length,
      actions: runActions.length,
      rules: runRules.length,
      screenSections: runScreenSections.length,
      brianCommands: brianRunCommands.length,
      backlogItems: runImplementationBacklog.length,
    },
    statuses: {
      run: ["draft", "scheduled", "in_progress", "paused", "completed", "cancelled", "aborted"] satisfies TestRunStatus[],
      runItem: ["not_run", "in_progress", "passed", "failed", "blocked", "skipped", "retest"] satisfies TestRunItemStatus[],
      qaseSync: ["pending", "synced", "failed", "skipped"] satisfies QaseResultSyncStatus[],
    },
    fields: {
      run: testRunFields,
      runItem: testRunItemFields,
    },
    actions: runActions,
    rules: runRules,
    screenSections: runScreenSections,
    brianCommands: brianRunCommands,
    backlog: runImplementationBacklog,
  };
}
