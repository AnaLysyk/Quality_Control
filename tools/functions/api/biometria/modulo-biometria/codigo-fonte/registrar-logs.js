// Logger configurado para rastreabilidade do processamento de digitais

'use strict';

const ORDEM_NIVEIS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const nivelMinimo = ORDEM_NIVEIS[process.env.LOG_LEVEL] ?? ORDEM_NIVEIS.info;

function registrar(nivel, mensagem, detalhes = {}) {
  if (ORDEM_NIVEIS[nivel] < nivelMinimo) return;

  const dataHora = new Date().toISOString();
  const complemento = Object.keys(detalhes).length > 0
    ? ` ${JSON.stringify(detalhes)}`
    : '';
  const linha = `[${dataHora}] [${nivel.toUpperCase()}] ${mensagem}${complemento}`;
  const escrever = nivel === 'error' ? console.error : nivel === 'warn' ? console.warn : console.log;

  escrever(linha);
}

const logger = {
  debug: (mensagem, detalhes) => registrar('debug', mensagem, detalhes),
  info: (mensagem, detalhes) => registrar('info', mensagem, detalhes),
  warn: (mensagem, detalhes) => registrar('warn', mensagem, detalhes),
  error: (mensagem, detalhes) => registrar('error', mensagem, detalhes),
};

module.exports = logger;
