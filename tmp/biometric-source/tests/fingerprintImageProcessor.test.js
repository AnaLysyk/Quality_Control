// tests/fingerprintImageProcessor.test.js
// Testes automatizados para processamento de imagem de digital

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ensureFingerprintBase64WithinLimit,
  inflateImageToTarget,
  bufferToBase64,
  estimateBase64Length,
  maxBytesForBase64Limit,
  isWsqFormat,
} = require('../src/fingerprintImageProcessor');
const {
  FingerprintBase64ExceededError,
  InvalidFingerprintImageError,
} = require('../src/errors');
const { MAX_BASE64_LENGTH } = require('../src/constants');

// ============================================================
// Helpers para gerar imagens de teste
// ============================================================

/**
 * Gera um PNG sintético com dimensões e conteúdo controlados.
 * @param {number} width
 * @param {number} height
 * @param {object} [opts]
 * @param {boolean} [opts.noise] - Se true, gera ruído (mais difícil de comprimir)
 * @returns {Promise<Buffer>}
 */
async function generateTestPng(width, height, opts = {}) {
  const channels = 1; // grayscale como digitais reais
  const pixelCount = width * height * channels;

  let rawPixels;
  if (opts.noise) {
    // Ruído aleatório — gera PNGs maiores (menos comprimíveis)
    rawPixels = Buffer.alloc(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      rawPixels[i] = Math.floor(Math.random() * 256);
    }
  } else {
    // Gradiente simples — gera PNGs menores (mais comprimíveis)
    rawPixels = Buffer.alloc(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      rawPixels[i] = i % 256;
    }
  }

  return sharp(rawPixels, {
    raw: { width, height, channels },
  })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/**
 * Gera um buffer que simula formato WSQ (magic bytes + dados fictícios).
 * @param {number} size - Tamanho total do buffer
 * @returns {Buffer}
 */
function generateFakeWsq(size) {
  const buf = Buffer.alloc(size);
  buf[0] = 0xFF;
  buf[1] = 0xA0;
  // preencher com dados pseudo-aleatórios
  for (let i = 2; i < size; i++) {
    buf[i] = (i * 31) % 256;
  }
  return buf;
}

// ============================================================
// Testes
// ============================================================

describe('Utilitários auxiliares', () => {
  test('bufferToBase64 converte buffer corretamente', () => {
    const buf = Buffer.from('hello world');
    const b64 = bufferToBase64(buf);
    expect(b64).toBe(buf.toString('base64'));
    expect(typeof b64).toBe('string');
  });

  test('estimateBase64Length calcula corretamente', () => {
    // 3 bytes → 4 chars
    expect(estimateBase64Length(3)).toBe(4);
    // 6 bytes → 8 chars
    expect(estimateBase64Length(6)).toBe(8);
    // 1 byte → 4 chars (com padding)
    expect(estimateBase64Length(1)).toBe(4);
    // 0 bytes → 0 chars
    expect(estimateBase64Length(0)).toBe(0);
  });

  test('maxBytesForBase64Limit calcula inverso corretamente', () => {
    const maxChars = 500_000;
    const maxBytes = maxBytesForBase64Limit(maxChars);
    // O Base64 de maxBytes deve caber em maxChars
    expect(estimateBase64Length(maxBytes)).toBeLessThanOrEqual(maxChars);
    // E maxBytes+1 ultrapassaria
    expect(estimateBase64Length(maxBytes + 3)).toBeGreaterThan(maxChars);
  });

  test('isWsqFormat detecta magic bytes WSQ corretamente', () => {
    expect(isWsqFormat(Buffer.from([0xFF, 0xA0, 0x00]))).toBe(true);
    expect(isWsqFormat(Buffer.from([0xFF, 0xA1, 0x00]))).toBe(false);
    expect(isWsqFormat(Buffer.from([0x89, 0x50]))).toBe(false); // PNG magic
    expect(isWsqFormat(null)).toBe(false);
    expect(isWsqFormat(Buffer.alloc(0))).toBe(false);
    expect(isWsqFormat(Buffer.alloc(1))).toBe(false);
  });
});

describe('ensureFingerprintBase64WithinLimit', () => {
  // Timeout generoso pois sharp pode demorar em imagens grandes
  jest.setTimeout(30_000);

  // --------------------------------------------------------
  // CASO 1: Imagem que já nasce dentro do limite
  // --------------------------------------------------------
  test('retorna imagem sem redução quando já está dentro do limite', async () => {
    // PNG pequeno com gradiente simples — alta compressibilidade
    const smallPng = await generateTestPng(320, 300);
    const result = await ensureFingerprintBase64WithinLimit(smallPng, {
      contextId: 'test-small',
    });

    expect(result.attempts).toBe(0);
    expect(result.format).toBe('png');
    expect(result.base64.length).toBeLessThanOrEqual(MAX_BASE64_LENGTH);
    expect(result.finalLength).toBe(result.base64.length);
    expect(typeof result.base64).toBe('string');
    // Verifica que é Base64 válido
    expect(() => Buffer.from(result.base64, 'base64')).not.toThrow();
  });

  // --------------------------------------------------------
  // CASO 2: Imagem que precisa de redução
  // --------------------------------------------------------
  test('reduz imagem quando Base64 excede o limite', async () => {
    // Gerar PNG grande com ruído — difícil de comprimir
    const largePng = await generateTestPng(640, 600, { noise: true });

    // Usar limite que force pelo menos 1 redução, mas seja alcançável
    const tightLimit = 500_000;
    const result = await ensureFingerprintBase64WithinLimit(largePng, {
      maxBase64Length: tightLimit,
      contextId: 'test-large',
    });

    expect(result.attempts).toBeGreaterThan(0);
    expect(result.format).toBe('png');
    expect(result.base64.length).toBeLessThanOrEqual(tightLimit);
    expect(result.finalLength).toBe(result.base64.length);
    expect(result.originalLength).toBeGreaterThan(result.finalLength);
  });

  // --------------------------------------------------------
  // CASO 3: Imagem que continua acima do limite após tentativas máximas
  // --------------------------------------------------------
  test('lança FingerprintBase64ExceededError quando não consegue reduzir', async () => {
    // Gerar imagem com ruído e definir limite impossível
    const noisyPng = await generateTestPng(640, 600, { noise: true });
    const impossibleLimit = 100; // Impossível caber em 100 chars

    await expect(
      ensureFingerprintBase64WithinLimit(noisyPng, {
        maxBase64Length: impossibleLimit,
        maxAttempts: 3,
        contextId: 'test-impossible',
      })
    ).rejects.toThrow(FingerprintBase64ExceededError);

    try {
      await ensureFingerprintBase64WithinLimit(noisyPng, {
        maxBase64Length: impossibleLimit,
        maxAttempts: 3,
        contextId: 'test-impossible-details',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(FingerprintBase64ExceededError);
      expect(err.code).toBe('FINGERPRINT_BASE64_EXCEEDED');
      expect(err.finalBase64Length).toBeGreaterThan(impossibleLimit);
      expect(err.maxAllowed).toBe(impossibleLimit);
      expect(err.attempts).toBe(3);
    }
  });

  // --------------------------------------------------------
  // CASO 4: Garantia de que o tamanho validado é do Base64,
  //         NÃO do arquivo em bytes
  // --------------------------------------------------------
  test('valida pelo tamanho da string Base64, não pelos bytes do arquivo', async () => {
    const png = await generateTestPng(640, 600, { noise: true });
    const fileSizeBytes = png.length;
    const base64String = png.toString('base64');
    const base64Length = base64String.length;

    // Base64 é sempre maior que bytes (~33% maior)
    expect(base64Length).toBeGreaterThan(fileSizeBytes);

    // Definir limite que aceita em bytes mas rejeita em Base64
    // Isso simula exatamente o bug original
    const limitBetweenBytesAndBase64 = Math.floor((fileSizeBytes + base64Length) / 2);

    if (base64Length > limitBetweenBytesAndBase64) {
      // O sistema antigo (baseado em bytes) acharia que está OK
      expect(fileSizeBytes).toBeLessThan(limitBetweenBytesAndBase64);

      // Nosso sistema (baseado em Base64) detecta que NÃO está OK
      // e aplica redução ou lança erro
      const result = await ensureFingerprintBase64WithinLimit(png, {
        maxBase64Length: limitBetweenBytesAndBase64,
        contextId: 'test-bytes-vs-base64',
      });

      // O resultado final DEVE respeitar o limite Base64
      expect(result.base64.length).toBeLessThanOrEqual(limitBetweenBytesAndBase64);
    }
  });

  // --------------------------------------------------------
  // CASO 5: WSQ dentro do limite é preservado
  // --------------------------------------------------------
  test('WSQ dentro do limite é retornado sem alteração', async () => {
    // Gerar WSQ fake pequeno
    const wsqBuffer = generateFakeWsq(1000);
    const result = await ensureFingerprintBase64WithinLimit(wsqBuffer, {
      contextId: 'test-wsq-ok',
    });

    expect(result.format).toBe('wsq');
    expect(result.attempts).toBe(0);
    expect(result.base64.length).toBeLessThanOrEqual(MAX_BASE64_LENGTH);
    // Verificar que o conteúdo não foi alterado
    const decoded = Buffer.from(result.base64, 'base64');
    expect(decoded.equals(wsqBuffer)).toBe(true);
  });

  // --------------------------------------------------------
  // CASO 6: WSQ acima do limite lança erro
  // --------------------------------------------------------
  test('WSQ acima do limite lança FingerprintBase64ExceededError', async () => {
    // Gerar WSQ fake grande
    const largeWsq = generateFakeWsq(500_000); // ~666K chars em Base64

    await expect(
      ensureFingerprintBase64WithinLimit(largeWsq, {
        contextId: 'test-wsq-large',
      })
    ).rejects.toThrow(FingerprintBase64ExceededError);
  });

  // --------------------------------------------------------
  // CASO 7: Input inválido
  // --------------------------------------------------------
  test('lança InvalidFingerprintImageError para buffer vazio', async () => {
    await expect(
      ensureFingerprintBase64WithinLimit(Buffer.alloc(0))
    ).rejects.toThrow(InvalidFingerprintImageError);
  });

  test('lança InvalidFingerprintImageError para input não-Buffer', async () => {
    await expect(
      ensureFingerprintBase64WithinLimit('not a buffer')
    ).rejects.toThrow(InvalidFingerprintImageError);

    await expect(
      ensureFingerprintBase64WithinLimit(null)
    ).rejects.toThrow(InvalidFingerprintImageError);
  });

  // --------------------------------------------------------
  // CASO 8: Número de tentativas é limitado (sem loop infinito)
  // --------------------------------------------------------
  test('respeita maxAttempts e não entra em loop infinito', async () => {
    const noisyPng = await generateTestPng(640, 600, { noise: true });

    try {
      await ensureFingerprintBase64WithinLimit(noisyPng, {
        maxBase64Length: 100,
        maxAttempts: 2,
        contextId: 'test-max-attempts',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(FingerprintBase64ExceededError);
      expect(err.attempts).toBe(2); // Exatamente 2, não mais
    }
  });

  // --------------------------------------------------------
  // CASO 9: Regressão — cenário real da Wallet (640x600 PNG)
  // --------------------------------------------------------
  test('regressão: PNG 640x600 com ruído cabe em 500.000 chars Base64', async () => {
    const realisticPng = await generateTestPng(640, 600, { noise: true });
    const result = await ensureFingerprintBase64WithinLimit(realisticPng, {
      contextId: 'test-wallet-regression',
    });

    expect(result.base64.length).toBeLessThanOrEqual(MAX_BASE64_LENGTH);
    expect(result.format).toBe('png');
    // Verificar que o resultado é um PNG válido
    const decoded = Buffer.from(result.base64, 'base64');
    const meta = await sharp(decoded).metadata();
    expect(meta.format).toBe('png');
  });

  // --------------------------------------------------------
  // CASO 10: JPEG como input é convertido para PNG corretamente
  // --------------------------------------------------------
  test('JPEG de entrada é processado corretamente', async () => {
    // Criar JPEG de teste
    const jpegBuffer = await sharp(
      Buffer.alloc(320 * 300, 128),
      { raw: { width: 320, height: 300, channels: 1 } }
    )
      .jpeg({ quality: 90 })
      .toBuffer();

    const result = await ensureFingerprintBase64WithinLimit(jpegBuffer, {
      contextId: 'test-jpeg-input',
    });

    // JPEG pequeno já cabe no limite — formato original é preservado
    expect(['jpeg', 'png']).toContain(result.format);
    expect(result.base64.length).toBeLessThanOrEqual(MAX_BASE64_LENGTH);
  });
});

describe('Propriedades dos erros', () => {
  test('FingerprintBase64ExceededError contém dados rastreáveis', () => {
    const err = new FingerprintBase64ExceededError(600_000, 500_000, 10);
    expect(err.name).toBe('FingerprintBase64ExceededError');
    expect(err.code).toBe('FINGERPRINT_BASE64_EXCEEDED');
    expect(err.finalBase64Length).toBe(600_000);
    expect(err.maxAllowed).toBe(500_000);
    expect(err.attempts).toBe(10);
    expect(err.message).toContain('600000');
    expect(err.message).toContain('500000');
    expect(err.message).toContain('10');
  });

  test('InvalidFingerprintImageError contém razão descritiva', () => {
    const err = new InvalidFingerprintImageError('corrupted file');
    expect(err.name).toBe('InvalidFingerprintImageError');
    expect(err.code).toBe('INVALID_FINGERPRINT_IMAGE');
    expect(err.message).toContain('corrupted file');
  });
});

// ============================================================
// Testes do modo ABOVE (inflateImageToTarget)
// ============================================================
describe('inflateImageToTarget (modo ABOVE)', () => {
  // --------------------------------------------------------
  // CASO 1: Imagem pequena é inflada para atingir alvo
  // --------------------------------------------------------
  test('infla imagem até Base64 atingir o alvo', async () => {
    const smallPng = await generateTestPng(320, 300, { noise: true });
    const originalBase64 = bufferToBase64(smallPng);
    const alvo = originalBase64.length * 3; // alvo 3x o tamanho original

    const result = await inflateImageToTarget(smallPng, 320, 300, alvo, 10, 'test-inflate');

    expect(result.base64.length).toBeGreaterThanOrEqual(alvo);
    expect(result.format).toBe('png');
    expect(result.attempts).toBeGreaterThan(0);
    // Verificar que é um PNG válido
    const decoded = Buffer.from(result.base64, 'base64');
    const meta = await sharp(decoded).metadata();
    expect(meta.format).toBe('png');
  });

  // --------------------------------------------------------
  // CASO 2: Imagem que já excede alvo retorna sem upscale
  // --------------------------------------------------------
  test('retorna sem upscale se imagem já excede alvo', async () => {
    const largePng = await generateTestPng(640, 600, { noise: true });
    const alvo = 1000; // alvo muito baixo

    const result = await inflateImageToTarget(largePng, 640, 600, alvo, 10, 'test-inflate-already');

    expect(result.base64.length).toBeGreaterThanOrEqual(alvo);
    expect(result.attempts).toBe(0);
  });

  // --------------------------------------------------------
  // CASO 3: Inflar para simular cenário ABOVE da Wallet (>500K)
  // --------------------------------------------------------
  test('infla imagem para ultrapassar 500.000 chars Base64', async () => {
    const png = await generateTestPng(320, 300, { noise: true });

    const result = await inflateImageToTarget(png, 320, 300, 500_001, 10, 'test-inflate-wallet');

    expect(result.base64.length).toBeGreaterThan(500_000);
    expect(result.format).toBe('png');
    // Resultado é PNG válido
    const decoded = Buffer.from(result.base64, 'base64');
    const meta = await sharp(decoded).metadata();
    expect(meta.format).toBe('png');
  });
});

// ============================================================
// Testes com dados reais do ticket (Bug Wallet - Digitais > 500K)
// ============================================================
describe('Bug Wallet — dados reais do ticket (processo 43229358)', () => {
  jest.setTimeout(60_000);

  const DEDO8_FILE = path.join(__dirname, '..', 'test_dedo8_real.b64');
  const WALLET_LIMIT = 512_000; // limite real da Wallet em bytes/chars
  const SPEC_LIMIT = MAX_BASE64_LENGTH; // limite da especificação: 500.000 chars

  // Pular testes se o arquivo não existir (CI sem dados reais)
  const hasRealData = fs.existsSync(DEDO8_FILE);

  // --------------------------------------------------------
  // CASO 11: Reprodução do bug — dedo 8 real excede ambos limites
  // --------------------------------------------------------
  (hasRealData ? test : test.skip)(
    'reprodução: dedo 8 real (685K chars) excede limite 500K e 512K',
    async () => {
      const b64Original = fs.readFileSync(DEDO8_FILE, 'utf-8').trim();
      const pngBuffer = Buffer.from(b64Original, 'base64');

      // Confirmar que excede ambos os limites
      expect(b64Original.length).toBeGreaterThan(SPEC_LIMIT);
      expect(b64Original.length).toBeGreaterThan(WALLET_LIMIT);

      // Confirmar que é PNG
      expect(pngBuffer[0]).toBe(0x89);
      expect(pngBuffer[1]).toBe(0x50);

      const meta = await sharp(pngBuffer).metadata();
      expect(meta.format).toBe('png');

      console.log('=== DADOS REAIS DO TICKET ===');
      console.log('Dedo 8 original: %d chars Base64, %d bytes', b64Original.length, pngBuffer.length);
      console.log('Dimensões: %dx%d', meta.width, meta.height);
      console.log('Limite spec: %d, Limite Wallet: %d', SPEC_LIMIT, WALLET_LIMIT);
      console.log('Excesso spec: %d chars, Excesso Wallet: %d chars',
        b64Original.length - SPEC_LIMIT, b64Original.length - WALLET_LIMIT);
    }
  );

  // --------------------------------------------------------
  // CASO 12: shrinkPngImage deve conseguir reduzir dedo 8 abaixo de 500K
  // --------------------------------------------------------
  (hasRealData ? test : test.skip)(
    'ensureFingerprintBase64WithinLimit reduz dedo 8 real para ≤ 500K chars',
    async () => {
      const b64Original = fs.readFileSync(DEDO8_FILE, 'utf-8').trim();
      const pngBuffer = Buffer.from(b64Original, 'base64');

      const result = await ensureFingerprintBase64WithinLimit(pngBuffer, {
        maxBase64Length: SPEC_LIMIT,
        contextId: 'ticket-dedo8-500K',
      });

      console.log('=== RESULTADO REDUÇÃO (limite 500K) ===');
      console.log('Original: %d chars -> Final: %d chars', b64Original.length, result.finalLength);
      console.log('Tentativas: %d, Formato: %s', result.attempts, result.format);
      console.log('Redução: %.1f%%', (1 - result.finalLength / b64Original.length) * 100);

      // ASSERT PRINCIPAL: deve caber no limite da spec
      expect(result.base64.length).toBeLessThanOrEqual(SPEC_LIMIT);
      expect(result.format).toBe('png');
      expect(result.attempts).toBeGreaterThan(0);

      // Verificar que ainda é um PNG válido
      const decoded = Buffer.from(result.base64, 'base64');
      const meta = await sharp(decoded).metadata();
      expect(meta.format).toBe('png');
    }
  );

  // --------------------------------------------------------
  // CASO 13: shrinkPngImage deve conseguir reduzir dedo 8 abaixo de 512K (Wallet real)
  // --------------------------------------------------------
  (hasRealData ? test : test.skip)(
    'ensureFingerprintBase64WithinLimit reduz dedo 8 real para ≤ 512K chars (limite Wallet)',
    async () => {
      const b64Original = fs.readFileSync(DEDO8_FILE, 'utf-8').trim();
      const pngBuffer = Buffer.from(b64Original, 'base64');

      const result = await ensureFingerprintBase64WithinLimit(pngBuffer, {
        maxBase64Length: WALLET_LIMIT,
        contextId: 'ticket-dedo8-512K',
      });

      console.log('=== RESULTADO REDUÇÃO (limite 512K Wallet) ===');
      console.log('Original: %d chars -> Final: %d chars', b64Original.length, result.finalLength);
      console.log('Tentativas: %d, Formato: %s', result.attempts, result.format);

      // ASSERT: deve caber no limite real da Wallet
      expect(result.base64.length).toBeLessThanOrEqual(WALLET_LIMIT);
      expect(result.format).toBe('png');

      // Verificar que ainda é um PNG válido
      const decoded = Buffer.from(result.base64, 'base64');
      const meta = await sharp(decoded).metadata();
      expect(meta.format).toBe('png');
    }
  );

  // --------------------------------------------------------
  // CASO 14: Todas as 10 digitais do JSON devem ser reduzidas com sucesso
  // --------------------------------------------------------
  (hasRealData ? test : test.skip)(
    'todas as 10 digitais do processo real são reduzidas para ≤ 500K chars',
    async () => {
      const jsonPath = path.resolve(
        'C:\\Users\\Testing Company\\Downloads\\BA_processo_43229358_dedo_8 (1).json'
      );
      if (!fs.existsSync(jsonPath)) {
        console.log('JSON completo não encontrado, pulando');
        return;
      }

      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const docs = data.documentos || [data];
      const doc = Array.isArray(docs) ? docs[0] : docs;
      const metas = doc.metadados || [];

      const fingerMetas = metas.filter(m => m.key && m.key.startsWith('impressao_digital_'));
      expect(fingerMetas.length).toBe(10);

      const results = [];

      for (const m of fingerMetas) {
        const b64 = m.valor;
        const pngBuf = Buffer.from(b64, 'base64');

        const result = await ensureFingerprintBase64WithinLimit(pngBuf, {
          maxBase64Length: SPEC_LIMIT,
          contextId: `ticket-${m.key}`,
        });

        results.push({
          key: m.key,
          originalLen: b64.length,
          finalLen: result.finalLength,
          attempts: result.attempts,
          format: result.format,
        });

        // Cada dedo DEVE caber no limite
        expect(result.base64.length).toBeLessThanOrEqual(SPEC_LIMIT);
      }

      console.log('\n=== RESULTADO TODAS AS DIGITAIS ===');
      console.log('%-25s  %8s  %8s  %4s  %s', 'DEDO', 'ORIGINAL', 'FINAL', 'TENT', 'STATUS');
      for (const r of results) {
        const status = r.finalLen <= SPEC_LIMIT ? 'OK' : 'FALHA';
        console.log('%-25s  %8d  %8d  %4d  %s', r.key, r.originalLen, r.finalLen, r.attempts, status);
      }
    }
  );
});
