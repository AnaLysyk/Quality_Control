// src/index.js
// Ponto de entrada — exporta todos os módulos públicos

'use strict';

const {
  ensureFingerprintBase64WithinLimit,
  inflateImageToTarget,
  bufferToBase64,
  estimateBase64Length,
  maxBytesForBase64Limit,
  isWsqFormat,
} = require('./fingerprintImageProcessor');

const {
  FingerprintBase64ExceededError,
  InvalidFingerprintImageError,
} = require('./errors');

const {
  MAX_BASE64_LENGTH,
  SPEC_WIDTH,
  SPEC_HEIGHT,
  SPEC_DPI,
  MAX_SHRINK_ATTEMPTS,
  ACCEPTED_FORMATS,
} = require('./constants');

module.exports = {
  // Função principal
  ensureFingerprintBase64WithinLimit,

  // Inflação (modo ABOVE)
  inflateImageToTarget,

  // Utilitários
  bufferToBase64,
  estimateBase64Length,
  maxBytesForBase64Limit,
  isWsqFormat,

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
