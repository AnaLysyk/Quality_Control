'use strict';

const fs = require('fs');
const path = require('path');
const { getPrismaClient } = require('./prismaClient');

const TEST_RESULT_FILE = path.join(__dirname, '..', 'generated', 'ultimo_resultado_teste.json');
const TEST_HISTORY_FILE = path.join(__dirname, '..', 'generated', 'historico_resultados_teste.json');
const HISTORY_LIMIT = 100;

function ensureGeneratedDir() {
  const dir = path.dirname(TEST_RESULT_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFileFallback(result) {
  ensureGeneratedDir();
  fs.writeFileSync(TEST_RESULT_FILE, JSON.stringify(result, null, 2));

  let history = [];

  if (fs.existsSync(TEST_HISTORY_FILE)) {
    try {
      const content = fs.readFileSync(TEST_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(content);
      history = Array.isArray(parsed) ? parsed : [];
    } catch (_erro) {
      history = [];
    }
  }

  history.unshift(result);
  fs.writeFileSync(TEST_HISTORY_FILE, JSON.stringify(history.slice(0, HISTORY_LIMIT), null, 2));
}

function readLatestFromFile() {
  if (!fs.existsSync(TEST_RESULT_FILE)) {
    return null;
  }

  const content = fs.readFileSync(TEST_RESULT_FILE, 'utf8');
  return JSON.parse(content);
}

function readHistoryFromFile() {
  if (fs.existsSync(TEST_HISTORY_FILE)) {
    const content = fs.readFileSync(TEST_HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }

  const latest = readLatestFromFile();
  return latest ? [latest] : [];
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function saveResultInDatabase(result, source) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return false;
  }

  await prisma.testExecution.create({
    data: {
      createdAt: result.dataHora ? new Date(result.dataHora) : new Date(),
      success: Boolean(result.sucesso),
      process: normalizeOptionalString(result.processo),
      protocol: normalizeOptionalString(result.protocolo),
      finger: normalizeOptionalString(result.dedo),
      format: normalizeOptionalString(result.formato),
      filePath: normalizeOptionalString(result.arquivo),
      fileName: normalizeOptionalString(result.arquivoNome),
      sizeBytes: normalizeOptionalNumber(result.tamanhoBytes),
      sizeBase64: normalizeOptionalNumber(result.tamanhoBase64),
      putStatus: normalizeOptionalNumber(result.putStatus),
      putResponse: normalizeOptionalString(result.putResposta),
      errorMessage: normalizeOptionalString(result.erro),
      source: normalizeOptionalString(source),
      rawResult: result,
    },
  });

  return true;
}

async function saveTestExecutionResult(result, source = 'unknown') {
  writeFileFallback(result);

  try {
    await saveResultInDatabase(result, source);
  } catch (_erro) {
    // Mantem a gravacao em arquivo como fallback silencioso.
  }
}

async function getLatestTestExecutionResult() {
  try {
    const prisma = getPrismaClient();

    if (prisma) {
      const item = await prisma.testExecution.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (item && item.rawResult) {
        return item.rawResult;
      }
    }
  } catch (_erro) {
    // Se o banco falhar, usa o arquivo local.
  }

  try {
    return readLatestFromFile();
  } catch (_erro) {
    return null;
  }
}

async function getTestExecutionHistory() {
  try {
    const prisma = getPrismaClient();

    if (prisma) {
      const items = await prisma.testExecution.findMany({
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
      });

      if (items.length > 0) {
        return items.map((item) => item.rawResult).filter(Boolean);
      }
    }
  } catch (_erro) {
    // Se o banco falhar, usa o arquivo local.
  }

  try {
    return readHistoryFromFile();
  } catch (_erro) {
    return [];
  }
}

module.exports = {
  saveTestExecutionResult,
  getLatestTestExecutionResult,
  getTestExecutionHistory,
};