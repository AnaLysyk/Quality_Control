import type { BrainNode } from "@prisma/client";
import type { BrainNodeAction } from "@/lib/brain/actions";

type QaIntent =
  | "bug_ticket"
  | "test_cases"
  | "regression"
  | "risk_analysis"
  | "evidence"
  | "permissions"
  | "automation"
  | "release_support"
  | "api_validation"
  | "general";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectIntent(message: string): QaIntent {
  const text = normalize(message);

  if (/\b(bug|defeito|erro|falha|quebrou|jira|ticket|obtido|esperado)\b/.test(text)) return "bug_ticket";
  if (/\b(caso|casos|cenario|cenarios|qase|teste|testes)\b/.test(text)) return "test_cases";
  if (/\b(regressao|checklist|validar tudo|smoke|sanity)\b/.test(text)) return "regression";
  if (/\b(risco|impacto|pode quebrar|afetado|criticidade|prioridade)\b/.test(text)) return "risk_analysis";
  if (/\b(evidencia|print|video|log|requestid|payload|response|stack|console)\b/.test(text)) return "evidence";
  if (/\b(permissao|perfil|usuario|acesso|empresa|role|403|401)\b/.test(text)) return "permissions";
  if (/\b(automatizar|automacao|playwright|postman|script|e2e|api test)\b/.test(text)) return "automation";
  if (/\b(release|aceite|homologacao|deploy|versao|pendencia)\b/.test(text)) return "release_support";
  if (/\b(endpoint|api|status code|post|get|put|delete|contrato|body|header)\b/.test(text)) return "api_validation";

  return "general";
}

function formatNodeContext(nodes: Array<Pick<BrainNode, "label" | "type" | "description">>) {
  if (!nodes.length) return "- Nenhum nó específico encontrado ainda. Vou trabalhar com a mensagem e o contexto atual.";

  return nodes
    .slice(0, 5)
    .map((node) => `- ${node.label} (${node.type})${node.description ? `: ${node.description}` : ""}`)
    .join("\n");
}

function formatAllowedActions(actions: BrainNodeAction[]) {
  if (!actions.length) return "- Nenhuma ação direta liberada para esse contexto.";

  return actions
    .slice(0, 6)
    .map((action) => `- ${action.label} [${action.type}]`)
    .join("\n");
}

function templateForIntent(intent: QaIntent) {
  switch (intent) {
    case "bug_ticket":
      return [
        "Modelo que vou montar:",
        "- Título",
        "- Ambiente",
        "- Pré-condição",
        "- Passos para reproduzir",
        "- Resultado obtido",
        "- Resultado esperado",
        "- Evidências",
        "- Impacto QA",
        "- Prioridade sugerida",
      ].join("\n");

    case "test_cases":
      return [
        "Modelo que vou gerar:",
        "- Cenário positivo",
        "- Cenários negativos",
        "- Cenários de borda",
        "- Validação por perfil/permissão",
        "- Validação por empresa/projeto",
        "- Dados de teste",
        "- Resultado esperado",
      ].join("\n");

    case "regression":
      return [
        "Checklist que vou montar:",
        "- Fluxo principal",
        "- Permissões",
        "- Integrações",
        "- Dados salvos no banco",
        "- APIs afetadas",
        "- Layout/tema",
        "- Regressão mínima",
        "- Critério de aceite",
      ].join("\n");

    case "risk_analysis":
      return [
        "Análise que vou entregar:",
        "- O que muda",
        "- Onde pode quebrar",
        "- Perfis afetados",
        "- Empresas/projetos afetados",
        "- Integrações afetadas",
        "- Risco técnico",
        "- Risco QA",
        "- Próximo teste obrigatório",
      ].join("\n");

    case "evidence":
      return [
        "Evidência que vou organizar:",
        "- Tela/rota",
        "- Ação feita",
        "- Log/erro",
        "- Payload/response",
        "- Status HTTP",
        "- Resultado obtido",
        "- Resultado esperado",
        "- Anexo/print/vídeo",
      ].join("\n");

    case "permissions":
      return [
        "Validação que vou fazer:",
        "- Usuário",
        "- Empresa ativa",
        "- Perfil/role",
        "- Módulo",
        "- Tela/rota",
        "- Ação esperada",
        "- Permissão necessária",
        "- Resultado permitido/bloqueado",
      ].join("\n");

    case "automation":
      return [
        "Plano de automação que vou sugerir:",
        "- Fluxo",
        "- Dados de teste",
        "- Seletores/telas",
        "- API envolvida",
        "- Asserts",
        "- Massa necessária",
        "- Script Playwright/Postman sugerido",
      ].join("\n");

    case "release_support":
      return [
        "Apoio de release que vou montar:",
        "- Itens da release",
        "- Bugs corrigidos",
        "- Smoke obrigatório",
        "- Regressão mínima",
        "- Riscos",
        "- Pendências",
        "- Aprovação/bloqueio",
      ].join("\n");

    case "api_validation":
      return [
        "Validação de API que vou montar:",
        "- Endpoint",
        "- Método",
        "- Headers/auth",
        "- Payload",
        "- Status esperado",
        "- Status obtido",
        "- Contrato",
        "- Validação no banco/sistema",
      ].join("\n");

    default:
      return [
        "Posso ajudar com:",
        "- Investigar erro",
        "- Explicar regra",
        "- Criar bug",
        "- Gerar caso de teste",
        "- Montar regressão",
        "- Validar permissão",
        "- Sugerir automação",
      ].join("\n");
  }
}

export function buildQaCopilotAnswer(input: {
  message: string;
  foundNodes: Array<Pick<BrainNode, "label" | "type" | "description">>;
  allowedActions: BrainNodeAction[];
}) {
  const intent = detectIntent(input.message);

  return [
    "Modo QA ativado.",
    "",
    "Contexto encontrado no Brain:",
    formatNodeContext(input.foundNodes),
    "",
    templateForIntent(intent),
    "",
    "Ações seguras disponíveis para seu perfil:",
    formatAllowedActions(input.allowedActions),
    "",
    "Segurança: eu consulto e monto contexto conforme empresa, usuário e permissão. Alteração real precisa permissão e confirmação.",
  ].join("\n");
}
