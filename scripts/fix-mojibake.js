#!/usr/bin/env node
/**
 * fix-mojibake.js
 * Corrige texto mojibake (UTF-8 lido como Latin-1) em arquivos .tsx/.ts/.tsx
 * Execução: node scripts/fix-mojibake.js
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob").sync || require("glob").globSync;

// Mapeamento de mojibake → caractere correto (PT-BR + símbolos comuns)
// Usando \uXXXX para evitar problemas de parsing com chars especiais
const REPLACEMENTS = [
  // Sequências compostas (mais específicas primeiro)
  ["\u00C3\u00A7\u00C3\u00A3o", "\u00E7\u00E3o"],   // ção
  ["\u00C3\u00A7\u00C3\u00B5es", "\u00E7\u00F5es"], // ções
  ["\u00C3\u00B5es", "\u00F5es"],                    // ões
  ["\u00C3\u00A3o", "\u00E3o"],                      // ão
  // Letras minúsculas acentuadas
  ["\u00C3\u00A9", "\u00E9"],  // é
  ["\u00C3\u00A7", "\u00E7"],  // ç
  ["\u00C3\u00A3", "\u00E3"],  // ã
  ["\u00C3\u00B3", "\u00F3"],  // ó
  ["\u00C3\u00AD", "\u00ED"],  // í
  ["\u00C3\u00A1", "\u00E1"],  // á
  ["\u00C3\u00A2", "\u00E2"],  // â
  ["\u00C3\u00B5", "\u00F5"],  // õ
  ["\u00C3\u00A0", "\u00E0"],  // à
  ["\u00C3\u00BA", "\u00FA"],  // ú
  ["\u00C3\u00AA", "\u00EA"],  // ê
  ["\u00C3\u00B4", "\u00F4"],  // ô
  ["\u00C3\u00BC", "\u00FC"],  // ü
  ["\u00C3\u00B1", "\u00F1"],  // ñ
  // Letras maiúsculas – segundo byte em faixa Windows-1252 (0x80–0x9F)
  ["\u00C3\u2030", "\u00C9"],  // É  (C3 89 → 89 = ‰ em Win-1252)
  ["\u00C3\u2021", "\u00C7"],  // Ç  (C3 87 → 87 = ‡ em Win-1252)
  ["\u00C3\u0161", "\u00DA"],  // Ú  (C3 9A → 9A = š em Win-1252)
  ["\u00C3\u201C", "\u00D3"],  // Ó  (C3 93 → 93 = " em Win-1252)
  ["\u00C3\u201D", "\u00D4"],  // Ô  (C3 94 → 94 = " em Win-1252)
  ["\u00C3\u2022", "\u00D5"],  // Õ  (C3 95 → 95 = • em Win-1252)
  ["\u00C3\u2013", "\u00D6"],  // Ö  (C3 96 → 96 = – em Win-1252)
  ["\u00C3\u02C6", "\u00C2"],  // Â  (C3 88 → 88 = ˆ em Win-1252)
  ["\u00C3\u02DC", "\u00C3"],  // Ã  (C3 98 → 98 = ˜ em Win-1252)  NOTE: only when followed by space/end
  // Símbolos tipográficos
  ["\u00E2\u20AC\u201D", "\u2014"], // — em dash  (â€")
  ["\u00E2\u20AC\u00A2", "\u2022"], // • bullet    (â€¢)
  ["\u00E2\u20AC\u2122", "\u2019"], // ' right single quote  (â€™)
  ["\u00E2\u20AC\u0153", "\u201C"], // " left double quote  (â€œ)
  ["\u00E2\u20AC\u009D", "\u201D"], // " right double quote  (â€\x9D) — control char
  ["\u00C2\u00B7", "\u00B7"],  // · middle dot
  ["\u00C2\u00BB", "\u00BB"],  // »
  ["\u00C2\u00AB", "\u00AB"],  // «
  ["\u00C2\u00B0", "\u00B0"],  // °
  ["\u00C2\u00BA", "\u00BA"],  // º ordinal
  ["\u00C2\u00AA", "\u00AA"],  // ª ordinal
];

function fixMojibake(text) {
  let result = text;
  for (const [from, to] of REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

// Encontrar todos os .tsx e .ts em app/
let files;
try {
  // Try glob (newer API)
  const { globSync } = require("glob");
  files = globSync("app/**/*.{tsx,ts}", { cwd: path.join(__dirname, "..") });
} catch {
  // Fallback: manual recursive walk
  files = [];
  function walk(dir) {
    const root = path.join(__dirname, "..", dir);
    if (!fs.existsSync(root)) return;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) files.push(rel);
    }
  }
  walk("app");
}

let totalFiles = 0;
let totalReplacements = 0;

for (const relPath of files) {
  const fullPath = path.join(__dirname, "..", relPath);
  const original = fs.readFileSync(fullPath, "utf8");
  const fixed = fixMojibake(original);
  if (fixed !== original) {
    fs.writeFileSync(fullPath, fixed, "utf8");
    // Count occurrences changed
    let count = 0;
    for (const [from] of REPLACEMENTS) {
      count += (original.split(from).length - 1);
    }
    console.log(`✔ ${relPath} (${count} substituição/ões)`);
    totalFiles++;
    totalReplacements += count;
  }
}

console.log(`\nPronto: ${totalFiles} arquivo(s) corrigido(s), aprox. ${totalReplacements} substituição(ões) total.`);
