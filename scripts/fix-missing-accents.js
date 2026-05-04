#!/usr/bin/env node
/**
 * fix-missing-accents.js
 * Corrige palavras sem acento (PT-BR) em strings e texto JSX.
 * Só substitui dentro de: "...", '...', `...`, e >...<  (texto JSX).
 * NÃO altera nomes de variáveis, chaves de objeto, imports ou classes.
 */

const fs = require("fs");
const path = require("path");

// Pares [sem acento → com acento]
// As chaves menores são processadas primeiro para evitar substituição parcial.
const WORDS = [
  // -------- ão / ões --------
  ["acao",         "ação"],
  ["acoes",        "ações"],
  ["Acao",         "Ação"],
  ["Acoes",        "Ações"],
  ["atualizacao",  "atualização"],
  ["Atualizacao",  "Atualização"],
  ["aplicacao",    "aplicação"],
  ["Aplicacao",    "Aplicação"],
  ["aplicacoes",   "aplicações"],
  ["Aplicacoes",   "Aplicações"],
  ["autenticacao", "autenticação"],
  ["Autenticacao", "Autenticação"],
  ["configuracao", "configuração"],
  ["Configuracao", "Configuração"],
  ["configuracoes","configurações"],
  ["Configuracoes","Configurações"],
  ["criacao",      "criação"],
  ["Criacao",      "Criação"],
  ["edicao",       "edição"],
  ["Edicao",       "Edição"],
  ["execucao",     "execução"],
  ["Execucao",     "Execução"],
  ["execucoes",    "execuções"],
  ["Execucoes",    "Execuções"],
  ["exclusao",     "exclusão"],
  ["Exclusao",     "Exclusão"],
  ["exportacao",   "exportação"],
  ["Exportacao",   "Exportação"],
  ["geracao",      "geração"],
  ["Geracao",      "Geração"],
  ["integracao",   "integração"],
  ["Integracao",   "Integração"],
  ["integracoes",  "integrações"],
  ["Integracoes",  "Integrações"],
  ["notificacao",  "notificação"],
  ["Notificacao",  "Notificação"],
  ["notificacoes", "notificações"],
  ["Notificacoes", "Notificações"],
  ["organizacao",  "organização"],
  ["Organizacao",  "Organização"],
  ["permissao",    "permissão"],
  ["Permissao",    "Permissão"],
  ["permissoes",   "permissões"],
  ["Permissoes",   "Permissões"],
  ["solicitacao",  "solicitação"],
  ["Solicitacao",  "Solicitação"],
  ["solicitacoes", "solicitações"],
  ["Solicitacoes", "Solicitações"],
  ["validacao",    "validação"],
  ["Validacao",    "Validação"],
  ["vinculacao",   "vinculação"],
  ["Vinculacao",   "Vinculação"],
  ["conexao",      "conexão"],
  ["Conexao",      "Conexão"],
  ["operacao",     "operação"],
  ["Operacao",     "Operação"],
  ["operacoes",    "operações"],
  ["Operacoes",    "Operações"],
  ["remocao",      "remoção"],
  ["Remocao",      "Remoção"],
  ["selecao",      "seleção"],
  ["Selecao",      "Seleção"],
  ["alteracao",    "alteração"],
  ["Alteracao",    "Alteração"],
  ["alteracoes",   "alterações"],
  ["Alteracoes",   "Alterações"],
  ["visualizacao", "visualização"],
  ["Visualizacao", "Visualização"],
  ["visao",        "visão"],
  ["Visao",        "Visão"],
  // -------- ão sem sufixo -ção --------
  ["nao",          "não"],
  ["Nao",          "Não"],
  ["ate",          "até"],
  ["Ate",          "Até"],
  ["padrao",       "padrão"],
  ["Padrao",       "Padrão"],
  ["versao",       "versão"],
  ["Versao",       "Versão"],
  ["ficara",       "ficará"],
  ["Ficara",       "Ficará"],
  ["so",           "só"],
  ["So",           "Só"],
  // -------- á / á --------
  ["analise",      "análise"],
  ["Analise",      "Análise"],
  ["administracao", "administração"],
  ["Administracao", "Administração"],
  ["descricao",    "descrição"],
  ["Descricao",    "Descrição"],
  ["possivel",     "possível"],
  ["Possivel",     "Possível"],
  ["informacao",   "informação"],
  ["Informacao",   "Informação"],
  ["informacoes",  "informações"],
  ["Informacoes",  "Informações"],
  ["disponivel",   "disponível"],
  ["Disponivel",   "Disponível"],
  ["disponiveis",  "disponíveis"],
  ["necessario",   "necessário"],
  ["Necessario",   "Necessário"],
  ["necessaria",   "necessária"],
  ["Necessaria",   "Necessária"],
  ["ha",           "há"],
  ["Ha",           "Há"],
  ["ja",           "já"],
  ["Ja",           "Já"],
  ["pagina",       "página"],
  ["Pagina",       "Página"],
  ["paginas",      "páginas"],
  ["Paginas",      "Páginas"],
  ["rapido",       "rápido"],
  ["Rapido",       "Rápido"],
  ["rapida",       "rápida"],
  ["Rapida",       "Rápida"],
  ["minimo",       "mínimo"],
  ["Minimo",       "Mínimo"],
  ["maximo",       "máximo"],
  ["Maximo",       "Máximo"],
  ["obrigatorio",  "obrigatório"],
  ["Obrigatorio",  "Obrigatório"],
  ["obrigatoria",  "obrigatória"],
  ["Obrigatoria",  "Obrigatória"],
  ["proprio",      "próprio"],
  ["Proprio",      "Próprio"],
  ["propria",      "própria"],
  ["Propria",      "Própria"],
  ["saude",        "saúde"],
  ["Saude",        "Saúde"],
  ["critico",      "crítico"],
  ["Critico",      "Crítico"],
  ["criticos",     "críticos"],
  ["Criticos",     "Críticos"],
  ["valida",       "válida"],
  ["Valida",       "Válida"],
  ["valido",       "válido"],
  ["Valido",       "Válido"],
  ["confiavel",    "confiável"],
  ["Confiavel",    "Confiável"],
  ["migracao",     "migração"],
  ["Migracao",     "Migração"],
  ["expoe",        "expõe"],
  ["Expoe",        "Expõe"],
  ["Responsavel",  "Responsável"],
  ["responsavel",  "responsável"],
  ["responsaveis", "responsáveis"],
  ["ultima",       "última"],
  ["Ultima",       "Última"],
  ["ultimas",      "últimas"],
  ["Ultimas",      "Últimas"],
  ["unico",        "único"],
  ["Unico",        "Único"],
  ["unica",        "única"],
  ["Unica",        "Única"],
  // -------- é / ê --------
  ["metricas",     "métricas"],
  ["Metricas",     "Métricas"],
  ["metrica",      "métrica"],
  ["Metrica",      "Métrica"],
  ["tecnico",      "técnico"],
  ["Tecnico",      "Técnico"],
  ["tecnicos",     "técnicos"],
  ["sera",         "será"],
  ["Sera",         "Será"],
  ["historico",    "histórico"],
  ["Historico",    "Histórico"],
  ["historicos",   "históricos"],
  // -------- í --------
  ["titulo",       "título"],
  ["Titulo",       "Título"],
  ["titulos",      "títulos"],
  // -------- ó --------
  ["repositorio",  "repositório"],
  ["Repositorio",  "Repositório"],
  // -------- ô --------
  // (none common in PT-BR app UI besides proper nouns)
  // -------- você --------
  ["voce",         "você"],
  ["Voce",         "Você"],
  // -------- vínculo --------
  ["vinculo",      "vínculo"],
  ["Vinculo",      "Vínculo"],
  ["vinculos",     "vínculos"],
  // -------- comentários --------
  ["comentario",   "comentário"],
  ["Comentario",   "Comentário"],
  ["comentarios",  "comentários"],
  ["Comentarios",  "Comentários"],
  // -------- outros --------
  ["usuario",      "usuário"],
  ["Usuario",      "Usuário"],
  ["usuarios",     "usuários"],
  ["Usuarios",     "Usuários"],
  ["numero",       "número"],
  ["Numero",       "Número"],
  ["numeros",      "números"],
  ["publico",      "público"],
  ["Publico",      "Público"],
  ["documentacao", "documentação"],
  ["Documentacao", "Documentação"],
  // -------- mojibake comum --------
  ["n�o",          "não"],
  ["N�o",          "Não"],
  ["h�",           "há"],
  ["H�",           "Há"],
  ["usu�rio",      "usuário"],
  ["Usu�rio",      "Usuário"],
  ["est�",         "está"],
  ["Est�",         "Está"],
];

// Constrói regex para cada palavra (word boundary \b)
const PAIRS = WORDS.map(([from, to]) => [new RegExp(`\\b${from}\\b`, "g"), to]);
const RAW_PAIRS = [
  ["â€¦", "…"],
  ["h�", "há"],
  ["H�", "Há"],
  ["est�", "está"],
  ["Est�", "Está"],
  ["n�o", "não"],
  ["N�o", "Não"],
  ["usu�rio", "usuário"],
  ["Usu�rio", "Usuário"],
];

/**
 * Substitui dentro de strings delimitadas por " ' ` e texto JSX (>...</>)
 * preservando o restante do código.
 */
function fixInStringsAndJSX(content) {
  let result = "";
  let i = 0;
  const len = content.length;

  while (i < len) {
    const ch = content[i];

    // --- Comentários de linha ---
    if (ch === "/" && content[i + 1] === "/") {
      const end = content.indexOf("\n", i);
      const slice = end === -1 ? content.slice(i) : content.slice(i, end);
      result += applyWords(slice);
      i = end === -1 ? len : end;
      continue;
    }

    // --- Comentários de bloco ---
    if (ch === "/" && content[i + 1] === "*") {
      const end = content.indexOf("*/", i + 2);
      const slice = end === -1 ? content.slice(i) : content.slice(i, end + 2);
      result += applyWords(slice);
      i = end === -1 ? len : end + 2;
      continue;
    }

    // --- String com " ---
    if (ch === '"') {
      const { text, advance } = readString(content, i, '"');
      result += applyWords(text);
      i += advance;
      continue;
    }

    // --- String com ' ---
    if (ch === "'") {
      const { text, advance } = readString(content, i, "'");
      result += applyWords(text);
      i += advance;
      continue;
    }

    // --- Template literal com ` ---
    if (ch === "`") {
      const { text, advance } = readTemplateLiteral(content, i);
      result += applyWords(text);
      i += advance;
      continue;
    }

    // --- Texto JSX: qualquer conteúdo entre > e < que não seja numa tag ---
    // Detectamos "> texto <" fora de strings/expressões
    if (ch === ">") {
      // Pegar texto até próximo < ou {
      const jsxEnd = findJSXTextEnd(content, i + 1);
      result += ">";
      result += applyWords(content.slice(i + 1, jsxEnd));
      i = jsxEnd;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function applyWords(text) {
  let out = text;
  for (const [from, to] of RAW_PAIRS) {
    out = out.split(from).join(to);
  }
  for (const [re, to] of PAIRS) {
    out = out.replace(re, to);
  }
  return out;
}

/** Lê uma string delimitada por `quote`, retornando texto e avanço */
function readString(content, start, quote) {
  let i = start + 1;
  while (i < content.length) {
    if (content[i] === "\\") { i += 2; continue; }
    if (content[i] === quote) { i++; break; }
    i++;
  }
  return { text: content.slice(start, i), advance: i - start };
}

/** Lê template literal (backtick), trata ${} como código */
function readTemplateLiteral(content, start) {
  let i = start + 1;
  let text = "`";
  while (i < content.length) {
    if (content[i] === "\\") { text += content[i] + content[i + 1]; i += 2; continue; }
    if (content[i] === "$" && content[i + 1] === "{") {
      // conteúdo da expressão — não alterar
      let depth = 1;
      text += "${";
      i += 2;
      while (i < content.length && depth > 0) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") depth--;
        text += content[i];
        i++;
      }
      continue;
    }
    if (content[i] === "`") { text += "`"; i++; break; }
    text += content[i];
    i++;
  }
  return { text, advance: i - start };
}

/** Encontra o fim do texto JSX (até próximo < ou {) */
function findJSXTextEnd(content, start) {
  let i = start;
  while (i < content.length) {
    const c = content[i];
    if (c === "<" || c === "{") break;
    i++;
  }
  return i;
}

// --- Coletar arquivos ---
const appDir = path.join(__dirname, "..", "app");
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
}
walk(appDir);

let totalFiles = 0;
let totalChanges = 0;

for (const fullPath of files) {
  const original = fs.readFileSync(fullPath, "utf8");
  const fixed = fixInStringsAndJSX(original);
  if (fixed !== original) {
    fs.writeFileSync(fullPath, fixed, "utf8");
    const relPath = path.relative(path.join(__dirname, ".."), fullPath);
    let count = 0;
    for (const [re] of PAIRS) {
      re.lastIndex = 0;
      const m = original.match(new RegExp(re.source, "g"));
      if (m) count += m.length;
    }
    console.log(`✔ ${relPath} (aprox. ${count} subst.)`);
    totalFiles++;
    totalChanges += count;
  }
}

console.log(`\nPronto: ${totalFiles} arquivo(s), aprox. ${totalChanges} substituição(ões).`);
