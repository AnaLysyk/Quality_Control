'use strict';

const fs = require('fs');
const path = require('path');
const { obterClientePrismaOpcional } = require('./cliente-prisma-opcional');

const TEST_RESULT_FILE = path.join(__dirname, '..', 'generated', 'ultimo_resultado_teste.json');
const TEST_HISTORY_FILE = path.join(__dirname, '..', 'generated', 'historico_resultados_teste.json');
const HISTORY_LIMIT = 100;

function garantirDiretorioGerado() {
  const dir = path.dirname(TEST_RESULT_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function salvarResultadoEmArquivo(result) {
  garantirDiretorioGerado();
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

function lerUltimoResultadoDoArquivo() {
  if (!fs.existsSync(TEST_RESULT_FILE)) {
    return null;
  }

  const content = fs.readFileSync(TEST_RESULT_FILE, 'utf8');
  return JSON.parse(content);
}

function lerHistoricoDoArquivo() {
  if (fs.existsSync(TEST_HISTORY_FILE)) {
    const content = fs.readFileSync(TEST_HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }

  const latest = lerUltimoResultadoDoArquivo();
  return latest ? [latest] : [];
}

function normalizarTextoOpcional(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
}

function normalizarNumeroOpcional(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function salvarResultadoNoBanco(result, source) {
  const prisma = obterClientePrismaOpcional();

  if (!prisma) {
    return false;
  }

  await prisma.testExecution.create({
    data: {
      createdAt: result.dataHora ? new Date(result.dataHora) : new Date(),
      success: Boolean(result.sucesso),
      process: normalizarTextoOpcional(result.processo),
      protocol: normalizarTextoOpcional(result.protocolo),
      finger: normalizarTextoOpcional(result.dedo),
      format: normalizarTextoOpcional(result.formato),
      filePath: normalizarTextoOpcional(result.arquivo),
      fileName: normalizarTextoOpcional(result.arquivoNome),
      sizeBytes: normalizarNumeroOpcional(result.tamanhoBytes),
      sizeBase64: normalizarNumeroOpcional(result.tamanhoBase64),
      putStatus: normalizarNumeroOpcional(result.putStatus),
      putResponse: normalizarTextoOpcional(result.putResposta),
      errorMessage: normalizarTextoOpcional(result.erro),
      source: normalizarTextoOpcional(source),
      rawResult: result,
    },
  });

  return true;
}

async function salvarResultadoExecucaoTeste(result, source = 'unknown') {
  salvarResultadoEmArquivo(result);

  try {
    await salvarResultadoNoBanco(result, source);
  } catch (_erro) {
    // Mantem a gravacao em arquivo como fallback silencioso.
  }
}

async function obterUltimoResultadoExecucaoTeste() {
  try {
    const prisma = obterClientePrismaOpcional();

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
    return lerUltimoResultadoDoArquivo();
  } catch (_erro) {
    return null;
  }
}

async function obterHistoricoExecucoesTeste() {
  try {
    const prisma = obterClientePrismaOpcional();

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
    return lerHistoricoDoArquivo();
  } catch (_erro) {
    return [];
  }
}

module.exports = {
  salvarResultadoExecucaoTeste,
  obterUltimoResultadoExecucaoTeste,
  obterHistoricoExecucoesTeste,
};
