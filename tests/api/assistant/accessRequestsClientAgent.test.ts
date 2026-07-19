/** @jest-environment jsdom */

import { runAccessRequestsClientAgentCommand } from "@/backend/assistant/accessRequestsClientAgent";

function makeVisible(element: Element) {
  Object.defineProperty(element, "offsetParent", {
    configurable: true,
    get: () => document.body,
  });
  return element;
}

function button(label: string, options: { aria?: string; title?: string } = {}) {
  const element = document.createElement("button");
  element.textContent = label;
  if (options.aria) element.setAttribute("aria-label", options.aria);
  if (options.title) element.setAttribute("title", options.title);
  makeVisible(element);
  document.body.appendChild(element);
  return element;
}

function select(options: Array<{ value: string; label: string }>) {
  const element = document.createElement("select");
  for (const option of options) {
    const child = document.createElement("option");
    child.value = option.value;
    child.textContent = option.label;
    element.appendChild(child);
  }
  makeVisible(element);
  document.body.appendChild(element);
  return element;
}

function tableRow(values: string[], actions: Array<{ text: string; aria?: string }> = []) {
  let table = document.querySelector("table");
  if (!table) {
    table = document.createElement("table");
    table.appendChild(document.createElement("tbody"));
    document.body.appendChild(table);
  }
  const row = document.createElement("tr");
  makeVisible(row);
  for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }
  const actionCell = document.createElement("td");
  for (const action of actions) {
    const actionButton = document.createElement("button");
    actionButton.textContent = action.text;
    if (action.aria) actionButton.setAttribute("aria-label", action.aria);
    makeVisible(actionButton);
    actionCell.appendChild(actionButton);
  }
  row.appendChild(actionCell);
  table.querySelector("tbody")?.appendChild(row);
  return row;
}

describe("runAccessRequestsClientAgentCommand", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  it("ignora outras telas e texto vazio", () => {
    expect(runAccessRequestsClientAgentCommand("/dashboard", "buscar Ana")).toBeNull();
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "   ")).toBeNull();
  });

  it("responde a saudação e continuação curta", () => {
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "Olá!")).toContain("agente da tela");
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "beleza")).toContain("Continuo na tela");
  });

  it("explica as ações disponíveis", () => {
    const result = runAccessRequestsClientAgentCommand("/admin/access-requests", "me explica o fluxo");
    expect(result).toContain("copiloto da tela");
    expect(result).toContain("aprovar, recusar ou remover");
  });

  it("preenche a busca e dispara eventos", () => {
    const input = document.createElement("input");
    input.placeholder = "Buscar por nome";
    makeVisible(input);
    const inputEvent = jest.fn();
    const changeEvent = jest.fn();
    input.addEventListener("input", inputEvent);
    input.addEventListener("change", changeEvent);
    document.body.appendChild(input);

    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "buscar pela Ana Paula")).toContain('"Ana Paula"');
    expect(input.value).toBe("Ana Paula");
    expect(inputEvent).toHaveBeenCalledTimes(1);
    expect(changeEvent).toHaveBeenCalledTimes(1);
  });

  it("informa quando não encontra o campo de busca", () => {
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "buscar Ana")).toContain("nao encontrei o campo");
  });

  it.each([
    ["status recusadas", "rejected", "Recusada", "rejeitado/recusado"],
    ["status aprovadas", "approved", "Aprovada", "status aprovado"],
    ["status abertas", "open", "Aberta", "status aberto"],
    ["status aguardando ajuste", "adjustment", "Aguardando ajuste", "aguardando ajuste"],
  ])("seleciona filtro de %s no select", (command, value, label, expected) => {
    const filter = select([{ value: "all", label: "Todos" }, { value, label }]);
    const change = jest.fn();
    filter.addEventListener("change", change);

    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", command)).toContain(expected);
    expect(filter.value).toBe(value);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("retorna mensagem clara quando o filtro de status não está visível", () => {
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "status recusadas")).toContain("não encontrei o filtro");
  });

  it.each([
    ["mostrar todas", "Todas", "mostrei todas"],
    ["filtrar novas", "Novas", "novas/abertas"],
    ["mostrar em ajuste", "Em ajuste", "em ajuste"],
    ["mostrar aprovadas", "Aprovadas", "aprovadas"],
    ["mostrar recusadas", "Recusadas", "recusadas/rejeitadas"],
  ])("aciona botão para comando %s", (command, label, expected) => {
    const target = button(label);
    const click = jest.spyOn(target, "click");
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", command)).toContain(expected);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("analisa tabela vazia", () => {
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "o que achou?")).toContain("Não encontrei solicitações visíveis");
  });

  it("resume as solicitações visíveis e aponta riscos", () => {
    tableRow([
      "Barbara Martins barbara@example.com Analista de QA",
      "Empresa A",
      "Usuário TC",
      "Aberta",
      "Definida",
      "2",
    ]);
    tableRow([
      "Carlos carlos@example.com Suporte Técnico",
      "",
      "Líder TC",
      "Recusada",
      "Pendente",
      "0",
    ]);

    const result = runAccessRequestsClientAgentCommand("/admin/access-requests", "analisa isso");
    expect(result).toContain("Achei 2 solicitação(ões)");
    expect(result).toContain("Barbara Martins — barbara@example.com");
    expect(result).toContain("1 solicitação(ões) sem empresa informada");
    expect(result).toContain("solicitações recusadas/rejeitadas");
    expect(result).toContain("solicitações abertas");
  });

  it("aciona PDF na primeira linha", () => {
    const row = tableRow(["Ana ana@example.com", "Empresa", "Perfil", "Aberta", "Ok", "0"], [
      { text: "PDF", aria: "Baixar solicitação em PDF" },
    ]);
    const target = row.querySelector("button") as HTMLButtonElement;
    const click = jest.spyOn(target, "click");

    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "baixar pdf da primeira")).toContain("acionei o PDF");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("abre edição da primeira linha", () => {
    const row = tableRow(["Ana", "Empresa", "Perfil", "Aberta", "Ok", "0"], [
      { text: "Editar", aria: "Editar/analisar solicitação" },
    ]);
    const target = row.querySelector("button") as HTMLButtonElement;
    const click = jest.spyOn(target, "click");

    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "editar a primeira")).toContain("modo de analise");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("abre visualização da primeira linha", () => {
    const row = tableRow(["Ana", "Empresa", "Perfil", "Aberta", "Ok", "0"], [
      { text: "Visualizar", aria: "Visualizar solicitação" },
    ]);
    const target = row.querySelector("button") as HTMLButtonElement;
    const click = jest.spyOn(target, "click");

    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "abrir a primeira")).toContain("modo de visualizacao");
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("retorna mensagens de falha para ações ausentes", () => {
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "baixar pdf")).toContain("nao encontrei o botao");
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "editar solicitação")).toContain("nao encontrei o botao");
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "visualizar solicitação")).toContain("nao encontrei o botao");
  });

  it("retorna null para comando desconhecido", () => {
    expect(runAccessRequestsClientAgentCommand("/admin/access-requests", "qualquer coisa sem ação")).toBeNull();
  });
});
