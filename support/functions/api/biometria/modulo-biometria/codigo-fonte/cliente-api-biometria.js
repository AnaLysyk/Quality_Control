// src/index.js
// Ponto de entrada — exporta todos os módulos públicos

'use strict';

const {
  ajustarDigitalAoLimiteBase64,
  aumentarImagemAteTamanhoAlvo,
  converterBufferParaBase64,
  estimarTamanhoBase64,
  calcularMaximoBytesParaBase64,
  ehFormatoWsq,
} = require('./processar-imagem-digital');

const {
  FingerprintBase64ExceededError,
  InvalidFingerprintImageError,
} = require('./erros');

const {
  MAX_BASE64_LENGTH,
  SPEC_WIDTH,
  SPEC_HEIGHT,
  SPEC_DPI,
  MAX_SHRINK_ATTEMPTS,
  ACCEPTED_FORMATS,
} = require('./constantes');

module.exports = {
  // Função principal
  ajustarDigitalAoLimiteBase64,

  // Inflação (modo ABOVE)
  aumentarImagemAteTamanhoAlvo,

  // Utilitários
  converterBufferParaBase64,
  estimarTamanhoBase64,
  calcularMaximoBytesParaBase64,
  ehFormatoWsq,

  // Erros
  FingerprintBase64ExceededError,
  InvalidFingerprintImageError,

  // Constantes
  MAX_BASE64_LENGTH,
  SPEC_WIDTH,
  SPEC_HEIGHT,
  SPEC_DPI,
  MAX_SHRINK_ATTEMPTS,
  ACCEPTED_FORMATS,
};
