import sharp from "sharp";

export {
  DEFAULT_FINGERPRINT_DPI,
  DEFAULT_FINGERPRINT_HEIGHT,
  DEFAULT_FINGERPRINT_WIDTH,
  DEFAULT_MAX_SHRINK_ATTEMPTS,
  DEFAULT_PNG_COMPRESSION_LEVEL,
  DEFAULT_SHRINK_SCALE_STEP,
  DEFAULT_WALLET_LIMIT,
  MAX_FINGERPRINT_BASE64_LENGTH,
  MAX_PNG_COMPRESSION_LEVEL,
} from "./constants";
import {
  DEFAULT_FINGERPRINT_DPI,
  DEFAULT_FINGERPRINT_HEIGHT,
  DEFAULT_FINGERPRINT_WIDTH,
  DEFAULT_MAX_SHRINK_ATTEMPTS,
  DEFAULT_PNG_COMPRESSION_LEVEL,
  DEFAULT_SHRINK_SCALE_STEP,
  MAX_FINGERPRINT_BASE64_LENGTH,
  MAX_PNG_COMPRESSION_LEVEL,
} from "./constants";

export class FingerprintBase64ExceededError extends Error {
  readonly code = "FINGERPRINT_BASE64_EXCEEDED";

  constructor(
    public readonly finalBase64Length: number,
    public readonly maxAllowed: number,
    public readonly attempts: number,
  ) {
    super(
      `Imagem de digital excede o limite após ${attempts} tentativa(s). ` +
        `Tamanho final Base64: ${finalBase64Length}, máximo permitido: ${maxAllowed}.`,
    );
    this.name = "FingerprintBase64ExceededError";
  }
}

export class InvalidFingerprintImageError extends Error {
  readonly code = "INVALID_FINGERPRINT_IMAGE";

  constructor(reason: string) {
    super(`Imagem de digital inválida: ${reason}`);
    this.name = "InvalidFingerprintImageError";
  }
}

export type FingerprintFormat = "png" | "jpeg" | "wsq" | string;

export type ProcessedFingerprintResult = {
  attempts: number;
  base64: string;
  finalLength: number;
  format: FingerprintFormat;
  originalLength: number;
};

export type EnsureFingerprintOptions = {
  contextId?: string;
  maxAttempts?: number;
  maxBase64Length?: number;
};

export function bufferToBase64(imageBuffer: Buffer) {
  return imageBuffer.toString("base64");
}

export function estimateBase64Length(byteLength: number) {
  return Math.ceil(byteLength / 3) * 4;
}

export function maxBytesForBase64Limit(maxBase64Chars: number) {
  return Math.floor((maxBase64Chars * 3) / 4);
}

export function isWsqFormat(buffer: Buffer | null | undefined) {
  if (!buffer || buffer.length < 2) return false;
  return buffer[0] === 0xff && buffer[1] === 0xa0;
}

async function shrinkPngImage(
  originalBuffer: Buffer,
  currentWidth: number,
  currentHeight: number,
  attempt: number,
) {
  const compressionLevel = Math.min(DEFAULT_PNG_COMPRESSION_LEVEL + attempt, MAX_PNG_COMPRESSION_LEVEL);
  const compressionOnlyAttempts = MAX_PNG_COMPRESSION_LEVEL - DEFAULT_PNG_COMPRESSION_LEVEL;
  let scaleFactor = 1;

  if (attempt > compressionOnlyAttempts) {
    const scaleAttempt = attempt - compressionOnlyAttempts;
    scaleFactor = Math.max(0.3, 1 - scaleAttempt * DEFAULT_SHRINK_SCALE_STEP);
  }

  const newWidth = Math.max(1, Math.round(currentWidth * scaleFactor));
  const newHeight = Math.max(1, Math.round(currentHeight * scaleFactor));

  let pipeline = sharp(originalBuffer);

  if (scaleFactor < 1) {
    pipeline = pipeline.resize(newWidth, newHeight, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });
  }

  return pipeline
    .png({
      adaptiveFiltering: true,
      compressionLevel,
      palette: false,
    })
    .toBuffer();
}

export async function inflateImageToTarget(
  originalBuffer: Buffer,
  originalWidth: number,
  originalHeight: number,
  targetBase64Length: number,
  maxAttempts = DEFAULT_MAX_SHRINK_ATTEMPTS,
) {
  let currentBuffer = await sharp(originalBuffer)
    .png({ adaptiveFiltering: false, compressionLevel: 0 })
    .toBuffer();

  let base64 = bufferToBase64(currentBuffer);
  const originalLength = base64.length;

  if (base64.length >= targetBase64Length) {
    return {
      attempts: 0,
      base64,
      finalLength: base64.length,
      format: "png",
      originalLength,
    } satisfies ProcessedFingerprintResult;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const scaleFactor = 1 + attempt * 0.15;
    const newWidth = Math.max(1, Math.round(originalWidth * scaleFactor));
    const newHeight = Math.max(1, Math.round(originalHeight * scaleFactor));

    currentBuffer = await sharp(originalBuffer)
      .resize(newWidth, newHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ adaptiveFiltering: false, compressionLevel: 0 })
      .toBuffer();

    base64 = bufferToBase64(currentBuffer);

    if (base64.length >= targetBase64Length) {
      return {
        attempts: attempt,
        base64,
        finalLength: base64.length,
        format: "png",
        originalLength,
      } satisfies ProcessedFingerprintResult;
    }
  }

  return {
    attempts: maxAttempts,
    base64,
    finalLength: base64.length,
    format: "png",
    originalLength,
  } satisfies ProcessedFingerprintResult;
}

export async function ensureFingerprintBase64WithinLimit(
  imageBuffer: Buffer,
  options: EnsureFingerprintOptions = {},
): Promise<ProcessedFingerprintResult> {
  const maxBase64Length = options.maxBase64Length ?? MAX_FINGERPRINT_BASE64_LENGTH;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_SHRINK_ATTEMPTS;

  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new InvalidFingerprintImageError("o conteúdo precisa ser um Buffer não vazio");
  }

  if (isWsqFormat(imageBuffer)) {
    const wsqBase64 = bufferToBase64(imageBuffer);
    if (wsqBase64.length <= maxBase64Length) {
      return {
        attempts: 0,
        base64: wsqBase64,
        finalLength: wsqBase64.length,
        format: "wsq",
        originalLength: wsqBase64.length,
      };
    }

    throw new FingerprintBase64ExceededError(wsqBase64.length, maxBase64Length, 0);
  }

  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(imageBuffer).metadata();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "metadados não puderam ser lidos";
    throw new InvalidFingerprintImageError(reason);
  }

  const originalWidth = DEFAULT_FINGERPRINT_WIDTH;
  const originalHeight = DEFAULT_FINGERPRINT_HEIGHT;
  const originalBase64Raw = bufferToBase64(imageBuffer);

  if (originalBase64Raw.length <= maxBase64Length) {
    return {
      attempts: 0,
      base64: originalBase64Raw,
      finalLength: originalBase64Raw.length,
      format: metadata.format || "unknown",
      originalLength: originalBase64Raw.length,
    };
  }

  const normalizedRasterBuffer = await sharp(imageBuffer)
    .grayscale()
    .resize(DEFAULT_FINGERPRINT_WIDTH, DEFAULT_FINGERPRINT_HEIGHT, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: DEFAULT_PNG_COMPRESSION_LEVEL })
    .toBuffer();

  let currentBuffer = normalizedRasterBuffer;
  let base64 = bufferToBase64(normalizedRasterBuffer);
  const originalLength = base64.length;

  if (base64.length <= maxBase64Length) {
    return {
      attempts: 0,
      base64,
      finalLength: base64.length,
      format: "png",
      originalLength,
    };
  }

  currentBuffer = await sharp(normalizedRasterBuffer)
    .png({ compressionLevel: DEFAULT_PNG_COMPRESSION_LEVEL })
    .toBuffer();
  base64 = bufferToBase64(currentBuffer);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    currentBuffer = await shrinkPngImage(normalizedRasterBuffer, originalWidth, originalHeight, attempt);
    base64 = bufferToBase64(currentBuffer);

    if (base64.length <= maxBase64Length) {
      return {
        attempts: attempt,
        base64,
        finalLength: base64.length,
        format: "png",
        originalLength,
      };
    }
  }

  throw new FingerprintBase64ExceededError(base64.length, maxBase64Length, maxAttempts);
}
