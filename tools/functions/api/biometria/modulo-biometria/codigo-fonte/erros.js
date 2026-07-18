// src/errors.js
// Erros rastreáveis para o fluxo de processamento de digitais

'use strict';

/**
 * Erro lançado quando a imagem da digital não pode ser reduzida
 * para caber dentro do limite Base64 aceito pela Wallet.
 */
class FingerprintBase64ExceededError extends Error {
  constructor(finalBase64Length, maxAllowed, attempts) {
    super(
      `Imagem de digital excede o limite da Wallet após ${attempts} tentativas de redução. ` +
      `Tamanho final do Base64: ${finalBase64Length} chars, máximo permitido: ${maxAllowed} chars.`
    );
    this.name = 'FingerprintBase64ExceededError';
    this.code = 'FINGERPRINT_BASE64_EXCEEDED';
    this.finalBase64Length = finalBase64Length;
    this.maxAllowed = maxAllowed;
    this.attempts = attempts;
  }
}

/**
 * Erro lançado quando o buffer de entrada é inválido ou não reconhecido.
 */
class InvalidFingerprintImageError extends Error {
  constructor(reason) {
    super(`Imagem de digital inválida: ${reason}`);
    this.name = 'InvalidFingerprintImageError';
    this.code = 'INVALID_FINGERPRINT_IMAGE';
  }
}

module.exports = {
  FingerprintBase64ExceededError,
  InvalidFingerprintImageError,
};
