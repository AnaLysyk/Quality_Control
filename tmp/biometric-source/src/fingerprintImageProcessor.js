// src/fingerprintImageProcessor.js
// Processamento e redução de imagens de digital para adequação ao limite da Wallet.
//
// CAUSA RAIZ DO PROBLEMA:
// O sistema anterior controlava o tamanho do arquivo PNG em bytes, mas a Wallet
// valida o tamanho da string Base64 em caracteres. A codificação Base64 inflaciona
// o tamanho em ~33% (4/3), então um arquivo de ~366KB em bytes pode gerar um Base64
// de ~500.000 caracteres. Controlar bytes não garante que o Base64 fique dentro do
// limite. Esta implementação valida diretamente o tamanho da string Base64 final.

'use strict';

const sharp = require('sharp');
const logger = require('./logger');
const {
  MAX_BASE64_LENGTH,
  SPEC_WIDTH,
  SPEC_HEIGHT,
  MAX_SHRINK_ATTEMPTS,
  SHRINK_SCALE_STEP,
  PNG_COMPRESSION_LEVEL_INITIAL,
  PNG_COMPRESSION_LEVEL_MAX,
} = require('./constants');
const {
  FingerprintBase64ExceededError,
  InvalidFingerprintImageError,
} = require('./errors');

/**
 * Converte um buffer de imagem para string Base64.
 * @param {Buffer} imageBuffer
 * @returns {string}
 */
function bufferToBase64(imageBuffer) {
  return imageBuffer.toString('base64');
}

/**
 * Calcula o tamanho estimado da string Base64 a partir do tamanho do buffer.
 * Base64 usa 4 caracteres para cada 3 bytes, com padding.
 * @param {number} byteLength
 * @returns {number}
 */
function estimateBase64Length(byteLength) {
  return Math.ceil(byteLength / 3) * 4;
}

/**
 * Calcula o tamanho máximo de bytes do arquivo para gerar Base64
 * dentro do limite de caracteres.
 * @param {number} maxBase64Chars
 * @returns {number}
 */
function maxBytesForBase64Limit(maxBase64Chars) {
  return Math.floor((maxBase64Chars * 3) / 4);
}

/**
 * Detecta se o buffer é WSQ pelo magic number.
 * WSQ files começam com 0xFF 0xA0.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isWsqFormat(buffer) {
  if (!buffer || buffer.length < 2) return false;
  return buffer[0] === 0xFF && buffer[1] === 0xA0;
}

/**
 * Reduz uma imagem PNG progressivamente usando sharp.
 *
 * Estratégia de redução em duas fases:
 * 1. Primeiro aumenta compressão PNG (sem perda de qualidade visual)
 * 2. Depois reduz escala progressivamente (com perda controlada de detalhe)
 *
 * @param {Buffer} originalBuffer - Buffer da imagem original
 * @param {number} currentWidth - Largura atual
 * @param {number} currentHeight - Altura atual
 * @param {number} attempt - Número da tentativa (1-based)
 * @returns {Promise<Buffer>} Buffer da imagem reduzida
 */
async function shrinkPngImage(originalBuffer, currentWidth, currentHeight, attempt) {
  // Fase 1: Primeiras tentativas aumentam apenas compressão PNG
  const compressionLevel = Math.min(
    PNG_COMPRESSION_LEVEL_INITIAL + attempt,
    PNG_COMPRESSION_LEVEL_MAX
  );

  // Fase 2: Após atingir compressão máxima, começa a reduzir escala
  const compressionOnlyAttempts = PNG_COMPRESSION_LEVEL_MAX - PNG_COMPRESSION_LEVEL_INITIAL;
  let scaleFactor = 1.0;

  if (attempt > compressionOnlyAttempts) {
    const scaleAttempt = attempt - compressionOnlyAttempts;
    scaleFactor = Math.max(0.3, 1.0 - (scaleAttempt * SHRINK_SCALE_STEP));
  }

  const newWidth = Math.round(currentWidth * scaleFactor);
  const newHeight = Math.round(currentHeight * scaleFactor);

  logger.debug('Shrink parameters', {
    attempt,
    compressionLevel,
    scaleFactor: scaleFactor.toFixed(3),
    dimensions: `${newWidth}x${newHeight}`,
  });

  let pipeline = sharp(originalBuffer);

  if (scaleFactor < 1.0) {
    pipeline = pipeline.resize(newWidth, newHeight, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    });
  }

  return pipeline
    .png({
      compressionLevel,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer();
}

/**
 * Infla uma imagem PNG para que o Base64 resultante atinja ou ultrapasse
 * um tamanho alvo. Usado para testes de cenário ABOVE (rejeição pela Wallet).
 *
 * Estratégia:
 * 1. Converte para PNG com compressão mínima (nível 0)
 * 2. Se ainda não atingiu o alvo, aumenta a escala progressivamente
 *
 * @param {Buffer} originalBuffer - Buffer da imagem original
 * @param {number} originalWidth - Largura original
 * @param {number} originalHeight - Altura original
 * @param {number} targetBase64Length - Tamanho alvo em chars Base64
 * @param {number} [maxAttempts=10] - Limite de tentativas
 * @param {string} [contextId='unknown'] - ID de rastreabilidade
 * @returns {Promise<{base64: string, format: string, attempts: number, finalLength: number}>}
 */
async function inflateImageToTarget(originalBuffer, originalWidth, originalHeight, targetBase64Length, maxAttempts = 10, contextId = 'unknown') {
  // Tentar primeiro sem compressão
  let currentBuffer = await sharp(originalBuffer)
    .png({ compressionLevel: 0, adaptiveFiltering: false })
    .toBuffer();

  let base64 = bufferToBase64(currentBuffer);

  logger.info('Modo ABOVE — inflando imagem para atingir alvo', {
    contextId,
    alvoBase64: targetBase64Length,
    base64Atual: base64.length,
  });

  if (base64.length >= targetBase64Length) {
    logger.info('Imagem já atingiu alvo sem upscale', {
      contextId,
      base64Length: base64.length,
    });
    return { base64, format: 'png', attempts: 0, finalLength: base64.length };
  }

  // Aumentar escala progressivamente até atingir o alvo
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const scaleFactor = 1.0 + (attempt * 0.15);
    const newWidth = Math.round(originalWidth * scaleFactor);
    const newHeight = Math.round(originalHeight * scaleFactor);

    currentBuffer = await sharp(originalBuffer)
      .resize(newWidth, newHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 0, adaptiveFiltering: false })
      .toBuffer();

    base64 = bufferToBase64(currentBuffer);

    logger.info('Tentativa de inflação (ABOVE)', {
      contextId,
      tentativa: attempt,
      escala: scaleFactor.toFixed(2),
      dimensoes: `${newWidth}x${newHeight}`,
      base64Length: base64.length,
      alvo: targetBase64Length,
      atingiu: base64.length >= targetBase64Length,
    });

    if (base64.length >= targetBase64Length) {
      logger.info('Alvo ABOVE atingido', {
        contextId,
        tentativa: attempt,
        base64Length: base64.length,
        alvo: targetBase64Length,
      });
      return { base64, format: 'png', attempts: attempt, finalLength: base64.length };
    }
  }

  // Retorna o que conseguiu, mesmo se não bateu exatamente o alvo
  logger.warn('Modo ABOVE — não atingiu alvo exato, retornando melhor resultado', {
    contextId,
    base64Length: base64.length,
    alvo: targetBase64Length,
  });
  return { base64, format: 'png', attempts: maxAttempts, finalLength: base64.length };
}

/**
 * Garante que a imagem de digital (fingerprint) gere um Base64 com no máximo
 * `maxBase64Length` caracteres. Se o formato original for WSQ e já estiver
 * dentro do limite, ele é preservado.
 *
 * @param {Buffer} imageBuffer - Buffer da imagem original (PNG, JPEG ou WSQ)
 * @param {object} [options]
 * @param {number} [options.maxBase64Length=500000] - Limite máximo de caracteres Base64
 * @param {number} [options.maxAttempts=10] - Número máximo de tentativas de redução
 * @param {string} [options.contextId] - ID para rastreabilidade nos logs
 * @returns {Promise<{base64: string, format: string, attempts: number, originalLength: number, finalLength: number}>}
 * @throws {FingerprintBase64ExceededError} Se não for possível reduzir dentro do limite
 * @throws {InvalidFingerprintImageError} Se o buffer de entrada for inválido
 */
async function ensureFingerprintBase64WithinLimit(imageBuffer, options = {}) {
  const {
    maxBase64Length = MAX_BASE64_LENGTH,
    maxAttempts = MAX_SHRINK_ATTEMPTS,
    contextId = 'unknown',
  } = options;

  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new InvalidFingerprintImageError('Input must be a non-empty Buffer');
  }

  // --- Priorizar WSQ se já estiver no formato ---
  if (isWsqFormat(imageBuffer)) {
    const wsqBase64 = bufferToBase64(imageBuffer);
    logger.info('Formato WSQ detectado, verificando tamanho Base64', {
      contextId,
      base64Length: wsqBase64.length,
      maxBase64Length,
    });

    if (wsqBase64.length <= maxBase64Length) {
      logger.info('Imagem WSQ dentro do limite Base64 — usando original', {
        contextId,
        base64Length: wsqBase64.length,
      });
      return {
        base64: wsqBase64,
        format: 'wsq',
        attempts: 0,
        originalLength: wsqBase64.length,
        finalLength: wsqBase64.length,
      };
    }

    // WSQ acima do limite: não conseguimos re-comprimir WSQ com sharp,
    // então reportamos erro explícito
    logger.error('Imagem WSQ excede limite Base64 e não pode ser recomprimida', {
      contextId,
      base64Length: wsqBase64.length,
      maxBase64Length,
    });
    throw new FingerprintBase64ExceededError(wsqBase64.length, maxBase64Length, 0);
  }

  // --- Ler metadata da imagem ---
  let metadata;
  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (err) {
    throw new InvalidFingerprintImageError(`Cannot read image metadata: ${err.message}`);
  }

  const originalWidth = metadata.width || SPEC_WIDTH;
  const originalHeight = metadata.height || SPEC_HEIGHT;

  // --- Verificar se o formato original já cabe no limite ---
  // Isso evita converter JPEG → PNG desnecessariamente (PNG lossless pode ser maior)
  const originalBase64Raw = bufferToBase64(imageBuffer);
  if (originalBase64Raw.length <= maxBase64Length) {
    const detectedFormat = metadata.format || 'unknown';
    logger.info('Imagem original já dentro do limite Base64 — preservando formato', {
      contextId,
      format: detectedFormat,
      fileSizeBytes: imageBuffer.length,
      base64Length: originalBase64Raw.length,
      maxBase64Length,
    });
    return {
      base64: originalBase64Raw,
      format: detectedFormat,
      attempts: 0,
      originalLength: originalBase64Raw.length,
      finalLength: originalBase64Raw.length,
    };
  }

  // --- Fluxo PNG — converter e tentar comprimir ---
  // Gerar PNG inicial com compressão padrão
  let currentBuffer = await sharp(imageBuffer)
    .png({ compressionLevel: PNG_COMPRESSION_LEVEL_INITIAL })
    .toBuffer();

  let base64 = bufferToBase64(currentBuffer);
  const originalBase64Length = base64.length;

  logger.info('Tamanho inicial do Base64 da digital', {
    contextId,
    format: metadata.format,
    dimensions: `${originalWidth}x${originalHeight}`,
    fileSizeBytes: currentBuffer.length,
    base64Length: base64.length,
    maxBase64Length,
    withinLimit: base64.length <= maxBase64Length,
  });

  // Se já está dentro do limite, retornar imediatamente
  if (base64.length <= maxBase64Length) {
    logger.info('Base64 da digital aprovado — dentro do limite', {
      contextId,
      base64Length: base64.length,
    });
    return {
      base64,
      format: 'png',
      attempts: 0,
      originalLength: originalBase64Length,
      finalLength: base64.length,
    };
  }

  // --- Loop de redução progressiva ---
  logger.warn('Imagem da digital excede limite Base64, iniciando redução progressiva', {
    contextId,
    excessChars: base64.length - maxBase64Length,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    currentBuffer = await shrinkPngImage(
      imageBuffer, // sempre partir do original para evitar degradação cumulativa
      originalWidth,
      originalHeight,
      attempt
    );

    base64 = bufferToBase64(currentBuffer);

    logger.info('Resultado da tentativa de redução', {
      contextId,
      attempt,
      maxAttempts,
      fileSizeBytes: currentBuffer.length,
      base64Length: base64.length,
      maxBase64Length,
      withinLimit: base64.length <= maxBase64Length,
    });

    if (base64.length <= maxBase64Length) {
      logger.info('Base64 da digital aprovado após redução', {
        contextId,
        attempt,
        originalBase64Length,
        finalBase64Length: base64.length,
        reductionPercent: ((1 - base64.length / originalBase64Length) * 100).toFixed(1),
      });
      return {
        base64,
        format: 'png',
        attempts: attempt,
        originalLength: originalBase64Length,
        finalLength: base64.length,
      };
    }
  }

  // --- Falha: não conseguiu reduzir dentro do limite ---
  logger.error('Imagem da digital NÃO conseguiu ser reduzida dentro do limite Base64', {
    contextId,
    finalBase64Length: base64.length,
    maxBase64Length,
    totalAttempts: maxAttempts,
    excessChars: base64.length - maxBase64Length,
  });

  throw new FingerprintBase64ExceededError(base64.length, maxBase64Length, maxAttempts);
}

module.exports = {
  ensureFingerprintBase64WithinLimit,
  inflateImageToTarget,
  bufferToBase64,
  estimateBase64Length,
  maxBytesForBase64Limit,
  isWsqFormat,
  shrinkPngImage,
};
