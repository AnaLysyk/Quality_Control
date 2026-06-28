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

function firstRequestRow() {
  return document.querySelector<HTMLTableRowElement>("tbody tr");
}

function clickFirstRowAction(labels: string[]) {
  const row = firstRequestRow();
  if (!row) return false;
  row.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  return clickByLabel(labels, row);
}

function extractSearchTerm(text: string) {
  const patterns = [
    /(?:buscar|busca|procura|procurar|encontra|encontrar)\s+(.+)/i,
    /(?:filtra|filtrar)\s+por\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) return match.replace(/^["']|["']$/g, "");
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

  if (text.includes("aprovada") || text.includes("aprovadas")) {
    return clickByLabel(["aprovadas"]) ? "Pronto, filtrei as solicitacoes aprovadas." : "Nao encontrei o filtro Aprovadas na tela.";
  }

  if (text.includes("recusada") || text.includes("recusadas") || text.includes("rejeitada") || text.includes("rejeitadas")) {
    return clickByLabel(["recusadas"]) ? "Pronto, filtrei as solicitacoes recusadas." : "Nao encontrei o filtro Recusadas na tela.";
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
