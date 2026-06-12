import fs from "node:fs";

import sharp from "sharp";

import {
  bufferToBase64,
  ensureFingerprintBase64WithinLimit,
  estimateBase64Length,
  FingerprintBase64ExceededError,
  inflateImageToTarget,
  InvalidFingerprintImageError,
  isWsqFormat,
  MAX_FINGERPRINT_BASE64_LENGTH,
  maxBytesForBase64Limit,
} from "@/lib/automations/biometrics/fingerprintProcessor";
import { resolveExistingLocalBiometricFixtures } from "@/lib/automations/biometrics/localFixtures";

function createSeededNoiseBuffer(width: number, height: number, seed = 17) {
  const buffer = Buffer.alloc(width * height);
  let state = seed;

  for (let index = 0; index < buffer.length; index += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    buffer[index] = state % 256;
  }

  return buffer;
}

async function generateTestPng(width: number, height: number, noise = false) {
  const rawPixels = noise
    ? createSeededNoiseBuffer(width, height)
    : Buffer.from(Array.from({ length: width * height }, (_, index) => index % 256));

  return sharp(rawPixels, {
    raw: {
      channels: 1,
      height,
      width,
    },
  })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

function createFakeWsq(size: number) {
  const buffer = Buffer.alloc(size);
  buffer[0] = 0xff;
  buffer[1] = 0xa0;

  for (let index = 2; index < size; index += 1) {
    buffer[index] = (index * 31) % 256;
  }

  return buffer;
}

describe("fingerprintProcessor", () => {
  jest.setTimeout(60_000);

  test("converte buffer para base64", () => {
    const buffer = Buffer.from("hello world");
    expect(bufferToBase64(buffer)).toBe(buffer.toString("base64"));
  });

  test("estima tamanho base64 corretamente", () => {
    expect(estimateBase64Length(3)).toBe(4);
    expect(estimateBase64Length(6)).toBe(8);
    expect(estimateBase64Length(1)).toBe(4);
    expect(estimateBase64Length(0)).toBe(0);
  });

  test("calcula bytes máximos para um limite base64", () => {
    const maxChars = 500_000;
    const maxBytes = maxBytesForBase64Limit(maxChars);
    expect(estimateBase64Length(maxBytes)).toBeLessThanOrEqual(maxChars);
    expect(estimateBase64Length(maxBytes + 3)).toBeGreaterThan(maxChars);
  });

  test("detecta WSQ pelo magic number", () => {
    expect(isWsqFormat(Buffer.from([0xff, 0xa0, 0x00]))).toBe(true);
    expect(isWsqFormat(Buffer.from([0xff, 0xa1, 0x00]))).toBe(false);
    expect(isWsqFormat(Buffer.from([0x89, 0x50]))).toBe(false);
    expect(isWsqFormat(null)).toBe(false);
  });

  test("preserva imagem já dentro do limite", async () => {
    const smallPng = await generateTestPng(320, 300, false);
    const result = await ensureFingerprintBase64WithinLimit(smallPng);

    expect(result.attempts).toBe(0);
    expect(result.finalLength).toBeLessThanOrEqual(MAX_FINGERPRINT_BASE64_LENGTH);
  });

  test("reduz imagem acima do limite", async () => {
    const largePng = await generateTestPng(640, 600, true);
    const result = await ensureFingerprintBase64WithinLimit(largePng, {
      maxBase64Length: 500_000,
    });

    expect(result.finalLength).toBeLessThanOrEqual(500_000);
    expect(result.originalLength).toBeGreaterThanOrEqual(result.finalLength);
  });

  test("falha quando o limite é impossível", async () => {
    const noisyPng = await generateTestPng(640, 600, true);

    await expect(
      ensureFingerprintBase64WithinLimit(noisyPng, {
        maxAttempts: 3,
        maxBase64Length: 100,
      }),
    ).rejects.toBeInstanceOf(FingerprintBase64ExceededError);
  });

  test("preserva WSQ dentro do limite", async () => {
    const wsq = createFakeWsq(1000);
    const result = await ensureFingerprintBase64WithinLimit(wsq);

    expect(result.format).toBe("wsq");
    expect(Buffer.from(result.base64, "base64").equals(wsq)).toBe(true);
  });

  test("rejeita WSQ acima do limite", async () => {
    const wsq = createFakeWsq(500_000);
    await expect(ensureFingerprintBase64WithinLimit(wsq)).rejects.toBeInstanceOf(FingerprintBase64ExceededError);
  });

  test("rejeita input inválido", async () => {
    await expect(ensureFingerprintBase64WithinLimit(Buffer.alloc(0))).rejects.toBeInstanceOf(InvalidFingerprintImageError);
    await expect(
      ensureFingerprintBase64WithinLimit("invalid" as unknown as Buffer),
    ).rejects.toBeInstanceOf(InvalidFingerprintImageError);
  });

  test("infla imagem para cenário above", async () => {
    const png = await generateTestPng(320, 300, true);
    const result = await inflateImageToTarget(png, 320, 300, 500_001, 10);

    expect(result.finalLength).toBeGreaterThan(500_000);
    expect(result.attempts).toBeGreaterThanOrEqual(0);
  });
});

describe("fingerprintProcessor com fixtures locais", () => {
  jest.setTimeout(60_000);

  const localFingerprints = resolveExistingLocalBiometricFixtures().filter(
    (fixture) => fixture.kind === "fingerprint" && fixture.index !== null,
  );

  if (localFingerprints.length === 0) {
    test("sem fixtures locais disponíveis", () => {
      expect(localFingerprints).toHaveLength(0);
    });
    return;
  }

  test.each(localFingerprints.map((fixture) => [fixture.slug, fixture.path]))(
    "mantém %s dentro do limite",
    async (_slug, fixturePath) => {
      const buffer = fs.readFileSync(fixturePath);
      const result = await ensureFingerprintBase64WithinLimit(buffer, {
        maxBase64Length: MAX_FINGERPRINT_BASE64_LENGTH,
      });

      expect(result.finalLength).toBeLessThanOrEqual(MAX_FINGERPRINT_BASE64_LENGTH);
    },
  );
});
