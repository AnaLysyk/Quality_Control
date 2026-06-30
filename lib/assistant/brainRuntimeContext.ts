export const BRAIN_RUNTIME_CONTEXT_MARKER = "[Brain runtime context]";

export function stripBrainRuntimeContext(value: string) {
  if (!value) return "";

  const markerIndex = value.indexOf(BRAIN_RUNTIME_CONTEXT_MARKER);
  const separatorIndex = value.indexOf("\n---\n");

  const indexes = [markerIndex, separatorIndex].filter((index) => index >= 0);
  const cutIndex = indexes.length ? Math.min(...indexes) : -1;

  return (cutIndex >= 0 ? value.slice(0, cutIndex) : value).trim();
}

export function normalizeBrainUserText(value: string) {
  return stripBrainRuntimeContext(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBrainGreetingOnly(value: string) {
  const clean = normalizeBrainUserText(value);

  return [
    "oi",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "e ai",
    "tudo bem",
    "hello",
    "hi"
  ].includes(clean);
}

export function brainGreetingReply() {
  return [
    "Oi. Estou conectado ao Brain e ao contexto atual da tela.",
    "",
    "Posso explicar o nó selecionado, mostrar conexões, abrir um núcleo, filtrar pendências, mostrar órfãos ou sugerir o próximo caminho."
  ].join("\n");
}
