function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function visibleButtons(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
    .filter((button) => !button.disabled && button.offsetParent !== null);
}

function buttonMatches(button: HTMLButtonElement, labels: string[]) {
  const normalizedLabels = labels.map(normalize);
  const aria = normalize(button.getAttribute("aria-label") ?? "");
  const title = normalize(button.getAttribute("title") ?? "");
  const text = normalize(button.textContent ?? "");
  return normalizedLabels.some((label) => aria.includes(label) || title.includes(label) || text.includes(label));
}

function clickByLabel(labels: string[], root: ParentNode = document) {
  const button = visibleButtons(root).find((candidate) => buttonMatches(candidate, labels));
  if (!button) return false;

  button.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  button.click();
  return true;
}

function findSearchInput() {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input"))
    .find((input) => {
      const placeholder = normalize(input.placeholder ?? "");
      const label = normalize(input.getAttribute("aria-label") ?? "");
      return input.offsetParent !== null && (placeholder.includes("buscar") || label.includes("buscar"));
    }) ?? null;
}

function fillSearch(value: string) {
  const input = findSearchInput();
  if (!input) return false;

  input.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function selectStatusOption(labels: string[]) {
  const normalizedLabels = labels.map(normalize);

  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"))
    .filter((select) => select.offsetParent !== null);

  for (const select of selects) {
    const options = Array.from(select.options);
    const option = options.find((candidate) => {
      const label = normalize(candidate.textContent ?? "");
      const value = normalize(candidate.value ?? "");
      return normalizedLabels.some((target) => label.includes(target) || value.includes(target));
    });

    if (!option) continue;

    select.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    select.focus();
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  return false;
}

function visibleRequestRows() {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>("tbody tr"))
    .filter((row) => row.offsetParent !== null);
}

function firstRequestRow() {
  return visibleRequestRows()[0] ?? null;
}

function compactCellText(cell: Element | undefined) {
  return (cell?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitRequesterCell(value: string) {
  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0] ?? "";

  let name = value;
  if (email) name = name.replace(email, " ");
  name = name
    .replace(/Analista de QA|Advogada|Suporte Tecnico|Suporte Técnico|Usuario TC|Usuário TC|Lider TC|Líder TC/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: name || "Solicitante",
    email,
  };
}

function readVisibleRequestSummary() {
  const rows = visibleRequestRows();

  return rows.map((row, index) => {
    const cells = Array.from(row.children);
    const requester = splitRequesterCell(compactCellText(cells[0]));
    const company = compactCellText(cells[1]) || "(não informado)";
    const profile = compactCellText(cells[2]) || "Perfil não informado";
    const status = compactCellText(cells[3]) || "Status não informado";
    const password = compactCellText(cells[4]) || "Senha não informada";
    const changes = compactCellText(cells[5]) || "0";

    return {
      index: index + 1,
      name: requester.name,
      email: requester.email,
      company,
      profile,
      status,
      password,
      changes,
    };
  });
}

function countBy(items: string[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item || "Não informado";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCounter(counter: Record<string, number>) {
  return Object.entries(counter)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function analyzeVisibleRequests() {
  const rows = readVisibleRequestSummary();

  if (rows.length === 0) {
    return [
      "Não encontrei solicitações visíveis na tabela agora.",
      "",
      "Pode ser que o filtro não tenha retornado resultado ou que a listagem ainda esteja carregando.",
    ].join("\n");
  }

  const statusCounter = countBy(rows.map((row) => row.status));
  const profileCounter = countBy(rows.map((row) => row.profile));
  const withCompany = rows.filter((row) => !/não informado|nao informado/i.test(row.company)).length;
  const withoutCompany = rows.length - withCompany;
  const withChanges = rows.filter((row) => Number(row.changes.replace(/\D/g, "")) > 0).length;

  const lines = rows.slice(0, 6).map((row) => {
    const emailPart = row.email ? ` — ${row.email}` : "";
    return `- ${row.name}${emailPart}: ${row.status}, perfil ${row.profile}, empresa ${row.company}, alterações ${row.changes}.`;
  });

  const attention: string[] = [];

  if (withoutCompany > 0) {
    attention.push(`${withoutCompany} solicitação(ões) sem empresa informada.`);
  }

  if (withChanges === 0) {
    attention.push("Nenhuma solicitação visível tem alteração marcada.");
  }

  if (rows.some((row) => /recusad|rejeitad/i.test(row.status))) {
    attention.push("Existem solicitações recusadas/rejeitadas no resultado; para elas não faz sentido editar/remover ajuste, só consultar histórico/PDF.");
  }

  if (rows.some((row) => /abert|nova/i.test(row.status))) {
    attention.push("Existem solicitações abertas; essas são as melhores para validar aprovar, recusar e pedir ajuste.");
  }

  return [
    `Achei ${rows.length} solicitação(ões) visíveis na listagem.`,
    "",
    `Status: ${formatCounter(statusCounter)}.`,
    `Perfis: ${formatCounter(profileCounter)}.`,
    `Empresa informada: ${withCompany}; sem empresa: ${withoutCompany}.`,
    `Com alterações marcadas: ${withChanges}.`,
    "",
    "O que estou vendo:",
    ...lines,
    "",
    "Minha leitura:",
    ...(attention.length ? attention.map((item) => `- ${item}`) : ["- A listagem está coerente visualmente para seguir com os testes."]),
    "",
    "Próximo passo recomendado: abrir uma solicitação aberta da Barbara Martins para validar o modal, depois testar PDF, ajuste e aprovação/recusa.",
  ].join("\n");
}

function isStatusFilterIntent(text: string) {
  return /\b(status|situacao|situação)\b/.test(text);
}

function isRejectedStatusIntent(text: string) {
  return (
    text.includes("recusado") ||
    text.includes("recusada") ||
    text.includes("recusados") ||
    text.includes("recusadas") ||
    text.includes("rejeitado") ||
    text.includes("rejeitada") ||
    text.includes("rejeitados") ||
    text.includes("rejeitadas")
  );
}

function isApprovedStatusIntent(text: string) {
  return text.includes("aprovado") || text.includes("aprovada") || text.includes("aprovados") || text.includes("aprovadas");
}

function isOpenStatusIntent(text: string) {
  return text.includes("aberto") || text.includes("aberta") || text.includes("abertos") || text.includes("abertas") || text.includes("nova") || text.includes("novas");
}

function isAdjustmentStatusIntent(text: string) {
  return text.includes("ajuste") || text.includes("ajustes") || text.includes("aguardando");
}

function isAnalyzeVisibleResultsIntent(text: string) {
  return (
    text.includes("o que achou") ||
    text.includes("oque achou") ||
    text.includes("o que acha") ||
    text.includes("analisa") ||
    text.includes("analise") ||
    text.includes("analisar isso") ||
    text.includes("o que tem aqui") ||
    text.includes("o que voce viu") ||
    text.includes("o que você viu") ||
    text.includes("tem algo errado") ||
    text.includes("resumo") ||
    text.includes("me diz") ||
    text.includes("me fala")
  );
}

function clickFirstRowAction(labels: string[]) {
  const row = firstRequestRow();
  if (!row) return false;
  row.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  return clickByLabel(labels, row);
}

function isAccessRequestsGreeting(text: string) {
  return /^(oi+|ola|olá|oie|bom dia|boa tarde|boa noite|e ai|e aí|hello|hi)[!?.\s]*$/i.test(normalize(text));
}

function isAccessRequestsFollowUp(text: string) {
  const normalized = normalize(text).replace(/[!?.,]/g, "").trim();

  return /^(tudo|td|tudo bem|tudo certo|beleza|blz|ok|okay|ta|tá|sim|ss|aham|uhum|bora|vamos|pode|pode sim|entendi|certo|show|fechou)$/.test(normalized);
}

function buildAccessRequestsAgentGreeting() {
  return [
    "Oi. Estou contigo como agente da tela de Solicitações de acesso.",
    "",
    "Pode mandar do jeito que vier, até bagunçado. Eu vou tentar entender a intenção antes de responder.",
    "",
    "Exemplos que eu já consigo tratar aqui:",
    "- buscar a Ana",
    "- filtrar recusadas",
    "- abrir a primeira solicitação",
    "- baixar PDF da solicitação visível",
    "- abrir em análise",
    "- explicar o que dá para fazer nesta tela",
  ].join("\n");
}

function buildAccessRequestsAgentFollowUp() {
  return [
    "Tudo certo. Continuo na tela de Solicitações de acesso.",
    "",
    "Me manda a ação do jeito que você falaria normalmente. Se ficar ambíguo, eu te pergunto antes de executar.",
    "",
    "Posso buscar pessoa, filtrar status, abrir solicitação, acionar PDF, explicar fluxo, ou te orientar em aprovação, recusa e ajuste.",
  ].join("\n");
}

function extractSearchTerm(text: string) {
  const patterns = [
    /(?:buscar|busca|procura|procurar|encontra|encontrar)\s+(.+)/i,
    /(?:filtra|filtrar)\s+por\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return match
        .replace(/^["']|["']$/g, "")
        .replace(/^(por|pela|pelo|a|o|as|os)\s+/i, "")
        .trim();
    }
  }
  return null;
}

function explainAccessRequests() {
  return [
    "Estou contigo nessa central de solicitacoes.",
    "",
    "Eu ajo como um copiloto da tela: primeiro entendo o que voce quer fazer, depois explico o caminho e executo a acao quando ela existe na interface.",
    "",
    "Pode pedir de forma natural. Eu consigo filtrar a fila, buscar uma pessoa, abrir a primeira solicitacao, entrar na analise pelo lapis, acionar o PDF e te orientar sobre aprovacao, recusa ou ajuste.",
    "",
    "Para acoes sensiveis, como aprovar, recusar ou remover, eu nao saio clicando no escuro. Eu explico o impacto, confiro as pendencias e peço confirmacao antes.",
  ].join("\n");
}

export function runAccessRequestsClientAgentCommand(pathname: string, rawText: string): string | null {
  if (typeof window === "undefined") return null;
  if (!pathname.startsWith("/admin/access-requests")) return null;

  const originalText = rawText.trim();
  const text = normalize(originalText);
  if (!text) return null;

  if (isAccessRequestsGreeting(originalText)) {
    return buildAccessRequestsAgentGreeting();
  }

  if (isAccessRequestsFollowUp(originalText)) {
    return buildAccessRequestsAgentFollowUp();
  }

  if (isAnalyzeVisibleResultsIntent(text)) {
    return analyzeVisibleRequests();
  }

  if (isStatusFilterIntent(text) && isRejectedStatusIntent(text)) {
    const selected = selectStatusOption(["rejeitada", "recusada"]) || clickByLabel(["recusadas", "rejeitadas"]);
    return selected
      ? "Pronto, filtrei pelo status rejeitado/recusado."
      : "Tentei filtrar por rejeitado/recusado, mas não encontrei o filtro de status visível.";
  }

  if (isStatusFilterIntent(text) && isApprovedStatusIntent(text)) {
    const selected = selectStatusOption(["aprovada", "aprovado"]) || clickByLabel(["aprovadas"]);
    return selected
      ? "Pronto, filtrei pelo status aprovado."
      : "Tentei filtrar por aprovado, mas não encontrei o filtro de status visível.";
  }

  if (isStatusFilterIntent(text) && isOpenStatusIntent(text)) {
    const selected = selectStatusOption(["aberta", "aberto"]) || clickByLabel(["novas"]);
    return selected
      ? "Pronto, filtrei pelo status aberto."
      : "Tentei filtrar por aberto, mas não encontrei o filtro de status visível.";
  }

  if (isStatusFilterIntent(text) && isAdjustmentStatusIntent(text)) {
    const selected = selectStatusOption(["aguardando ajuste", "ajuste"]) || clickByLabel(["em ajuste"]);
    return selected
      ? "Pronto, filtrei pelo status aguardando ajuste."
      : "Tentei filtrar por ajuste, mas não encontrei o filtro de status visível.";
  }

  const searchTerm = extractSearchTerm(originalText);
  if (searchTerm && !/(nova|novas|aberta|abertas|ajuste|aprovada|aprovadas|recusada|recusadas|rejeitada|rejeitadas)/.test(normalize(searchTerm))) {
    return fillSearch(searchTerm)
      ? `Pronto, busquei por "${searchTerm}" na fila de solicitacoes.`
      : "Eu tentei buscar, mas nao encontrei o campo de busca visivel nesta tela.";
  }

  if (
    text.includes("explicar") ||
    text.includes("ensina") ||
    text.includes("o que posso fazer") ||
    text.includes("como agente") ||
    text.includes("ajuda") ||
    text.includes("fluxo")
  ) {
    return explainAccessRequests();
  }

  if (text.includes("todas")) {
    return clickByLabel(["todas"]) ? "Pronto, mostrei todas as solicitacoes." : "Nao encontrei o filtro Todas na tela.";
  }

  if (text.includes("nova") || text.includes("novas") || text.includes("aberta") || text.includes("abertas")) {
    return clickByLabel(["novas"]) ? "Pronto, filtrei as solicitacoes novas/abertas." : "Nao encontrei o filtro Novas na tela.";
  }

  if (text.includes("ajuste") || text.includes("em ajuste")) {
    return clickByLabel(["em ajuste"]) ? "Pronto, filtrei as solicitacoes em ajuste." : "Nao encontrei o filtro Em ajuste na tela.";
  }

  if (text.includes("aprovado") || text.includes("aprovada") || text.includes("aprovados") || text.includes("aprovadas")) {
    return clickByLabel(["aprovadas"]) ? "Pronto, filtrei as solicitacoes aprovadas." : "Nao encontrei o filtro Aprovadas na tela.";
  }

  if (
    text.includes("recusado") ||
    text.includes("recusada") ||
    text.includes("recusados") ||
    text.includes("recusadas") ||
    text.includes("rejeitado") ||
    text.includes("rejeitada") ||
    text.includes("rejeitados") ||
    text.includes("rejeitadas")
  ) {
    return clickByLabel(["recusadas"]) ? "Pronto, filtrei as solicitacoes recusadas/rejeitadas." : "Nao encontrei o filtro Recusadas na tela.";
  }

  if (text.includes("pdf") || text.includes("baixar") || text.includes("download")) {
    const clicked = text.includes("primeira")
      ? clickFirstRowAction(["baixar solicitacao em pdf", "pdf"])
      : clickByLabel(["baixar solicitacao em pdf", "pdf"]);
    return clicked
      ? "Pronto, acionei o PDF da solicitacao visivel."
      : "Eu tentei baixar o PDF, mas nao encontrei o botao na solicitacao visivel.";
  }

  if (text.includes("lapis") || text.includes("editar") || text.includes("analise") || text.includes("analisar")) {
    const clicked = text.includes("primeira")
      ? clickFirstRowAction(["editar/analisar solicitacao", "editar", "analisar"])
      : clickByLabel(["editar/analisar solicitacao", "editar", "analisar"]);
    return clicked
      ? "Pronto, abri a solicitacao em modo de analise."
      : "Eu tentei abrir a analise, mas nao encontrei o botao de lapis visivel.";
  }

  if (text.includes("olho") || text.includes("visualizar") || text.includes("abrir") || text.includes("mostrar")) {
    const clicked = text.includes("primeira")
      ? clickFirstRowAction(["visualizar solicitacao", "visualizar"])
      : clickByLabel(["visualizar solicitacao", "visualizar"]);
    return clicked
      ? "Pronto, abri a solicitacao em modo de visualizacao."
      : "Eu tentei abrir a solicitacao, mas nao encontrei o botao de olho visivel.";
  }

  return null;
}

