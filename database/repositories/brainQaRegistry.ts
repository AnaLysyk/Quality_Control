import "server-only";

export type BrainEvalStatus = "ready" | "draft" | "blocked";

export type BrainEvalCase = {
  id: string;
  suite: string;
  title: string;
  userInput: string;
  expectedBehavior: string[];
  evidenceRequired: string[];
  status: BrainEvalStatus;
  priority: "critical" | "high" | "medium";
};

export type BrainPromptTemplate = {
  id: string;
  name: string;
  version: string;
  owner: string;
  purpose: string;
  guardrails: string[];
  expectedOutput: string[];
  linkedEvalIds: string[];
  status: "active" | "draft";
};

export type BrainQuickAction = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  outputType: "ticket" | "checklist" | "evidence" | "analysis" | "qase";
  requiredEvidence: string[];
};

export const brainEvalCases: BrainEvalCase[] = [
  {
    id: "eval-public-request-email-flow",
    suite: "Solicitacoes publicas",
    title: "Validar fluxo publico com log e mensagem enviada",
    userInput: "Valida a ultima solicitacao publica e confirma se teve log e mensagem enviada.",
    expectedBehavior: [
      "Localizar a solicitacao mais recente.",
      "Conferir log de criacao, decisao e ajuste quando existir.",
      "Conferir mensagem capturada vinculada por chave, id ou destinatario.",
      "Apontar claramente o que passou e o que ficou sem evidencia.",
    ],
    evidenceRequired: ["access_request.created", "html da mensagem", "status atual", "rota publica"],
    status: "ready",
    priority: "critical",
  },
  {
    id: "eval-generate-jira-ticket",
    suite: "QA assistido",
    title: "Gerar ticket de bug com evidencia tecnica",
    userInput: "Gera um ticket Jira para esse erro com log, atual, esperado e impacto.",
    expectedBehavior: [
      "Separar titulo, ambiente, pre-condicao, passos, atual, esperado, impacto e evidencias.",
      "Nao inventar log ausente.",
      "Marcar campos sem evidencia como pendentes.",
    ],
    evidenceRequired: ["erro", "print ou video", "rota ou payload quando existir"],
    status: "ready",
    priority: "high",
  },
  {
    id: "eval-qase-case-generation",
    suite: "Casos de teste",
    title: "Gerar caso Qase a partir de regra e evidencia",
    userInput: "Transforma esse comportamento em caso Qase com pre-condicao, passos e resultado esperado.",
    expectedBehavior: [
      "Criar caso objetivo e reutilizavel.",
      "Separar dados de teste de passos.",
      "Indicar se o caso serve para regressao ou aceitacao.",
    ],
    evidenceRequired: ["regra", "fluxo", "resultado esperado"],
    status: "ready",
    priority: "high",
  },
  {
    id: "eval-compare-expected-current",
    suite: "Validacao funcional",
    title: "Comparar esperado x atual",
    userInput: "Compara o comportamento atual com o esperado e me diz se reprova.",
    expectedBehavior: [
      "Declarar esperado e atual em blocos separados.",
      "Apontar divergencia objetiva.",
      "Informar se e bug, melhoria ou falta de evidencia.",
    ],
    evidenceRequired: ["descricao atual", "criterio esperado", "evidencia visual ou log"],
    status: "ready",
    priority: "critical",
  },
  {
    id: "eval-operation-run-control",
    suite: "Operacao QA",
    title: "Controlar run a partir de plano e repositorio",
    userInput: "Brian, reprova o caso de login na run de regressao e registra meu tempo.",
    expectedBehavior: [
      "Confirmar projeto, plano, run e caso quando houver ambiguidade.",
      "Bloquear acao se a run nao estiver vinculada a um plano.",
      "Registrar responsavel, status, motivo, inicio/fim ou duracao do item.",
      "Sugerir defeito quando o status for failed.",
      "Atualizar metricas por pessoa, projeto e run.",
    ],
    evidenceRequired: ["projectId", "planId", "runId", "caseId", "assigneeId", "status", "motivo/evidencia"],
    status: "ready",
    priority: "critical",
  },
  {
    id: "eval-memory-source-control",
    suite: "Memoria auditavel",
    title: "Responder com origem da memoria usada",
    userInput: "O que voce lembra desse fluxo e de onde veio essa informacao?",
    expectedBehavior: [
      "Separar memoria de fato observado na conversa atual.",
      "Indicar fonte quando existir.",
      "Avisar quando a memoria for insuficiente.",
    ],
    evidenceRequired: ["fonte", "data aproximada", "escopo"],
    status: "draft",
    priority: "medium",
  },
];

export const brainPromptTemplates: BrainPromptTemplate[] = [
  {
    id: "brain.system.qa.v1",
    name: "Brain System QA",
    version: "1.0.0",
    owner: "Quality Control",
    purpose: "Definir o Brain como central de QA, rastreabilidade, evidencia e acao operacional.",
    guardrails: [
      "Nao afirmar sucesso sem evidencia.",
      "Separar fato, inferencia e pendencia.",
      "Priorizar linguagem direta e acionavel.",
      "Registrar quando precisar de log, mensagem ou print.",
    ],
    expectedOutput: ["resumo", "evidencias", "riscos", "proxima acao"],
    linkedEvalIds: ["eval-public-request-email-flow", "eval-compare-expected-current"],
    status: "active",
  },
  {
    id: "brain.ticket.bug.v1",
    name: "Gerador de ticket de bug",
    version: "1.0.0",
    owner: "QA",
    purpose: "Transformar evidencias em ticket estilo Jira.",
    guardrails: ["Nao inventar ambiente", "Nao ocultar erro tecnico", "Explicar impacto para negocio"],
    expectedOutput: ["titulo", "ambiente", "passos", "atual", "esperado", "impacto", "evidencias"],
    linkedEvalIds: ["eval-generate-jira-ticket"],
    status: "active",
  },
  {
    id: "brain.qase.case.v1",
    name: "Gerador de caso Qase",
    version: "1.0.0",
    owner: "QA",
    purpose: "Gerar casos de teste padronizados para regressao, aceitacao e automacao futura.",
    guardrails: ["Passos curtos", "Resultado esperado verificavel", "Marcar automacao quando aplicavel"],
    expectedOutput: ["suite", "titulo", "pre-condicao", "passos", "resultado esperado", "tipo"],
    linkedEvalIds: ["eval-qase-case-generation"],
    status: "active",
  },
  {
    id: "brain.flow.validator.v1",
    name: "Validador de fluxo",
    version: "1.0.0",
    owner: "Quality Control",
    purpose: "Validar ponta a ponta um fluxo com rota, log, mensagem, status e evidencia.",
    guardrails: ["Exigir evidencia por etapa", "Apontar etapa quebrada", "Sugerir teste manual direto"],
    expectedOutput: ["timeline", "passou", "falhou", "sem evidencia", "acao"],
    linkedEvalIds: ["eval-public-request-email-flow", "eval-compare-expected-current"],
    status: "active",
  },
  {
    id: "brain.operation.controller.v1",
    name: "Controlador de operacao QA",
    version: "1.0.0",
    owner: "Quality Control",
    purpose: "Permitir que o Brian consulte projeto, repositorio, plano, run, caso, responsavel, tempo, evidencia e metricas antes de executar uma acao operacional.",
    guardrails: [
      "Nao criar run sem plano.",
      "Nao marcar caso sem run item.",
      "Perguntar qual caso quando houver ambiguidade.",
      "Exigir motivo ou evidencia para failed e blocked.",
      "Registrar ator, projeto, entidade e acao para auditoria.",
    ],
    expectedOutput: ["confirmacao", "entidade alterada", "responsavel", "status", "tempo", "evidencia", "impacto nas metricas"],
    linkedEvalIds: ["eval-operation-run-control"],
    status: "active",
  },
];

export const brainQuickActions: BrainQuickAction[] = [
  {
    id: "validate-flow",
    label: "Validar fluxo",
    description: "Confere rota, status, log, mensagem enviada e evidencia visual.",
    prompt: "Valide este fluxo ponta a ponta. Separe: rota chamada, status, log encontrado, mensagem enviada, evidencia, resultado atual, esperado e veredito QA.",
    outputType: "analysis",
    requiredEvidence: ["rota", "status", "log", "mensagem ou print"],
  },
  {
    id: "generate-bug-ticket",
    label: "Gerar ticket",
    description: "Monta bug estilo Jira usando as evidencias disponiveis.",
    prompt: "Gere um ticket de bug direto e completo com titulo, ambiente, pre-condicao, passos, resultado atual, resultado esperado, impacto, criticidade e evidencias.",
    outputType: "ticket",
    requiredEvidence: ["erro", "passos", "evidencia"],
  },
  {
    id: "generate-qase-case",
    label: "Gerar caso Qase",
    description: "Transforma regra ou bug em caso de teste padrao Qase.",
    prompt: "Gere um caso Qase com suite, titulo, descricao, pre-condicao, dados de teste, passos e resultado esperado. Marque se serve para regressao e automacao.",
    outputType: "qase",
    requiredEvidence: ["regra", "fluxo", "esperado"],
  },
  {
    id: "build-evidence-note",
    label: "Gerar evidencia",
    description: "Cria resumo objetivo de evidencia para anexar no Jira/Qase.",
    prompt: "Crie uma nota de evidencia com contexto, acao executada, resultado observado, anexos/logs e conclusao de QA.",
    outputType: "evidence",
    requiredEvidence: ["print ou video", "log ou payload", "resultado observado"],
  },
  {
    id: "compare-expected-current",
    label: "Esperado x atual",
    description: "Compara comportamento esperado com o comportamento atual.",
    prompt: "Compare esperado x atual. Diga se reprova, se e bug ou melhoria, qual evidencia falta e qual seria o proximo teste manual.",
    outputType: "checklist",
    requiredEvidence: ["esperado", "atual", "evidencia"],
  },
  {
    id: "start-run-from-plan",
    label: "Iniciar run por plano",
    description: "Cria ou inicia execucao somente a partir de um plano de teste.",
    prompt: "Inicie uma run a partir de um plano. Confirme projeto, plano, casos incluidos, responsavel, data de inicio e crie os itens da execucao com status not_run.",
    outputType: "checklist",
    requiredEvidence: ["projectId", "planId", "casos do plano", "responsavel"],
  },
  {
    id: "mark-run-item-result",
    label: "Marcar resultado da run",
    description: "Passa, reprova, bloqueia ou pula um caso dentro de uma run.",
    prompt: "Marque o resultado de um caso dentro da run. Se houver mais de um caso, pergunte qual. Registre responsavel, status, motivo, tempo, nota e evidencia quando falhar ou bloquear.",
    outputType: "analysis",
    requiredEvidence: ["runId", "caseId", "status", "responsavel", "motivo"],
  },
  {
    id: "link-case-automation",
    label: "Vincular automacao",
    description: "Conecta caso candidato a script automatizado.",
    prompt: "Vincule este caso ao script de automacao informado. Valide se o caso possui passos e esperado, registre scriptPath, framework, comando e altere o status para automated ou automation_outdated quando necessario.",
    outputType: "checklist",
    requiredEvidence: ["caseId", "scriptPath", "framework", "comando"],
  },
  {
    id: "summarize-project-metrics",
    label: "Resumo do projeto",
    description: "Gera resumo executivo com base nas metricas operacionais.",
    prompt: "Gere um resumo executivo do projeto usando casos, planos, runs, pessoas, defeitos, notas e automacao. Separe numeros reais, riscos, gargalos e proximas acoes.",
    outputType: "analysis",
    requiredEvidence: ["projectId", "periodo", "metricas", "fontes"],
  },
];

export function listBrainEvalCases() {
  return brainEvalCases;
}

export function listBrainPromptTemplates() {
  return brainPromptTemplates;
}

export function listBrainQuickActions() {
  return brainQuickActions;
}

export function getBrainQaSummary() {
  const readyEvals = brainEvalCases.filter((item) => item.status === "ready").length;
  const activePrompts = brainPromptTemplates.filter((item) => item.status === "active").length;
  return {
    evals: brainEvalCases.length,
    readyEvals,
    prompts: brainPromptTemplates.length,
    activePrompts,
    quickActions: brainQuickActions.length,
  };
}

