// src/constants.js
// Constantes para processamento de imagens de digital (fingerprint) para Wallet

'use strict';

/** Tamanho máximo da string Base64 aceito pela Wallet (em caracteres) */
const MAX_BASE64_LENGTH = 500_000;

/** Dimensões esperadas pela especificação */
const SPEC_WIDTH = 640;
const SPEC_HEIGHT = 600;

/** Resolução esperada pela especificação */
const SPEC_DPI = 500;

/** Número máximo de tentativas de redução antes de retornar erro */
const MAX_SHRINK_ATTEMPTS = 10;

/** Fator de redução progressiva a cada tentativa (reduz qualidade ou escala) */
const SHRINK_SCALE_STEP = 0.05;

/** Formatos aceitos pela Wallet */
const ACCEPTED_FORMATS = ['wsq', 'png', 'jpeg'];

/** Nível de compressão PNG (0-9, onde 9 é máxima compressão) */
const PNG_COMPRESSION_LEVEL_INITIAL = 6;
const PNG_COMPRESSION_LEVEL_MAX = 9;

module.exports = {
  MAX_BASE64_LENGTH,
  SPEC_WIDTH,
  SPEC_HEIGHT,
  SPEC_DPI,
  MAX_SHRINK_ATTEMPTS,
  SHRINK_SCALE_STEP,
  ACCEPTED_FORMATS,
  PNG_COMPRESSION_LEVEL_INITIAL,
  PNG_COMPRESSION_LEVEL_MAX,
};
