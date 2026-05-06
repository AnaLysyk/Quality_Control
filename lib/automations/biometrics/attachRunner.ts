import "server-only";

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { getBiometricConfigPreview } from "./config";
import { MAX_FINGERPRINT_BASE64_LENGTH } from "./constants";
import {
  ensureFingerprintBase64WithinLimit,
  inflateImageToTarget,
} from "./fingerprintProcessor";
import { findLocalBiometricFixture } from "./localFixtures";

export type BiometricAttachMode = "ABOVE" | "BELOW";

export type BiometricApiConfig = {
  host: string;
  password: string;
  port: number;
  user: string;
};

export type BiometricAttachInput = {
  companySlug?: string | null;
  config?: Partial<BiometricApiConfig>;
  faceFilePath?: string | null;
  faceFixture?: string | null;
  faceIndex?: number | null;
  fingerprintFilePath?: string | null;
  fingerprintFixture?: string | null;
  fingerprintFormat?: string | null;
  fingerprintIndex?: number | null;
  includeFace?: boolean;
  mode?: "above" | "below" | BiometricAttachMode | null;
  outputDir?: string | null;
  processId?: string | null;
  protocol?: string | null;
  target?: number | null;
};

type RequestResponse<TResponse> = {
  json: TResponse | null;
  raw: string;
  status: number;
};

type ProcessBiometricSummary = {
  faceCount: number;
  fingerprintCount: number;
  selectedFingerprintContentLength: number;
  selectedFingerprintFormat: string | null;
  selectedFingerprintPresent: boolean;
  status: string | null;
  totalBiometrics: number;
};

export type BiometricAttachExecution = {
  after: unknown;
  afterSummary: ProcessBiometricSummary;
  before: unknown;
  beforeSummary: ProcessBiometricSummary;
  companySlug: string | null;
  durationMs: number;
  faceIncluded: boolean;
  fingerprintBase64Length: number;
  fingerprintFormat: string;
  fingerprintIndex: number;
  fingerprintLabel: string;
  host: string;
  latestOutputPath: string;
  mode: BiometricAttachMode;
  outputPath: string;
  processId: string;
  putResponse: string;
  putStatus: number;
  target: number;
  user: string;
};

function toRelativeOutputPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function resolveConfig(config?: Partial<BiometricApiConfig>): BiometricApiConfig {
  const host = config?.host || process.env.SC_BIOMETRICS_API_HOST || "172.16.1.146";
  const port = Number(config?.port || process.env.SC_BIOMETRICS_API_PORT || "8100");
  const user = config?.user || process.env.SC_BIOMETRICS_API_USER || "admin";
  const password = config?.password || process.env.SC_BIOMETRICS_API_PASSWORD || "";

  if (!password.trim()) {
    throw new Error("Defina `SC_BIOMETRICS_API_PASSWORD` ou informe a senha manualmente.");
  }

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Porta inválida para a API biométrica.");
  }

  return { host, password, port, user };
}

function resolveFingerprintInput(input: BiometricAttachInput) {
  const fixture = input.fingerprintFixture ? findLocalBiometricFixture(input.fingerprintFixture) : null;
  const filePath = input.fingerprintFilePath || fixture?.path || "";
  const rawFormat = (input.fingerprintFormat || path.extname(filePath).replace(".", "") || "png").trim().toUpperCase();
  const format = rawFormat === "JPG" ? "JPEG" : rawFormat;
  const indexValue = input.fingerprintIndex ?? fixture?.index ?? null;
  const index = Number(indexValue);

  if (!filePath) {
    throw new Error("Informe uma fixture biométrica ou um arquivo de digital.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de digital não encontrado: ${filePath}`);
  }

  if (!Number.isFinite(index)) {
    throw new Error("Informe o índice do dedo ou escolha uma fixture padrão com índice conhecido.");
  }

  return {
    filePath,
    format,
    index,
    label: fixture?.label || path.basename(filePath),
  };
}

function resolveFaceInput(input: BiometricAttachInput) {
  if (input.includeFace === false) return null;

  const fixture = input.faceFixture ? findLocalBiometricFixture(input.faceFixture) : findLocalBiometricFixture("face");
  const filePath = input.faceFilePath || fixture?.path || "";

  if (!filePath) return null;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de face não encontrado: ${filePath}`);
  }

  const extension = path.extname(filePath).toLowerCase();
  const format = extension === ".png" ? "PNG" : "JPEG";
  const indexValue = input.faceIndex ?? fixture?.index ?? 10;

  return {
    filePath,
    format,
    index: Number(indexValue),
  };
}

async function buildFingerprintPayload(input: BiometricAttachInput, filePath: string) {
  const inputBuffer = fs.readFileSync(filePath);
  const mode: BiometricAttachMode = String(input.mode || "below").trim().toUpperCase() === "ABOVE" ? "ABOVE" : "BELOW";
  const target = Number(input.target || (mode === "ABOVE" ? "520000" : String(MAX_FINGERPRINT_BASE64_LENGTH)));

  if (mode === "ABOVE") {
    const metadata = await sharp(inputBuffer).metadata();
    const inflated = await inflateImageToTarget(inputBuffer, metadata.width || 640, metadata.height || 600, target);
    return {
      attempts: inflated.attempts,
      base64: inflated.base64,
      finalLength: inflated.finalLength,
      format: "PNG",
      mode,
      target,
    };
  }

  const processed = await ensureFingerprintBase64WithinLimit(inputBuffer, { maxBase64Length: target });
  return {
    attempts: processed.attempts,
    base64: processed.base64,
    finalLength: processed.finalLength,
    format: processed.format.toUpperCase(),
    mode,
    target,
  };
}

async function requestJson<TResponse>(
  config: BiometricApiConfig,
  token: string | null,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<RequestResponse<TResponse>> {
  const baseUrl = `http://${config.host}:${config.port}`;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });

  const raw = await response.text();
  let json: TResponse | null = null;

  try {
    json = raw ? (JSON.parse(raw) as TResponse) : null;
  } catch {
    json = null;
  }

  return {
    json,
    raw,
    status: response.status,
  };
}

async function obtainToken(config: BiometricApiConfig) {
  const response = await requestJson<{ data?: { token?: string } }>(config, null, "POST", "/api/tokens", {
    data: {
      grantType: "CREDENTIALS",
      userName: config.user,
      userPassword: config.password,
    },
  });

  const token = response.json?.data?.token;

  if (!token) {
    throw new Error(`Falha ao autenticar. Status ${response.status}. Resposta: ${response.raw.slice(0, 500)}`);
  }

  return token;
}

async function resolveProcessId(config: BiometricApiConfig, token: string, input: BiometricAttachInput) {
  const processId = input.processId?.trim();
  const protocol = input.protocol?.trim();

  if (processId) return processId;
  if (!protocol) {
    throw new Error("Informe `processId` ou `protocol`.");
  }

  const response = await requestJson<{ data?: Array<{ keys?: Array<{ id?: string; value?: string }>; processId?: string }> }>(
    config,
    token,
    "POST",
    "/api/processos/list",
    { data: { limit: 100, offset: 0 } },
  );

  const found = response.json?.data?.find((item) =>
    item.keys?.some((key) => key.id?.toLowerCase() === "protocol" && key.value === protocol),
  );

  if (!found?.processId) {
    throw new Error(`Não foi possível localizar processo para o protocolo ${protocol}.`);
  }

  return String(found.processId);
}

async function fetchProcess(config: BiometricApiConfig, token: string, processId: string) {
  return requestJson<{ data?: unknown }>(config, token, "GET", `/api/processos/${processId}`);
}

async function attachBiometrics(config: BiometricApiConfig, token: string, processId: string, body: unknown) {
  return requestJson(config, token, "PUT", `/api/processos/${processId}/biometrics`, body);
}

function ensureGeneratedDir(outputDir?: string | null) {
  const dir = path.resolve(process.cwd(), outputDir || path.join("generated", "biometrics"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeProcessBiometrics(processData: unknown, fingerprintIndex: number): ProcessBiometricSummary {
  const payload = isRecord(processData) ? processData : null;
  const biometrics = Array.isArray(payload?.biometrics) ? payload.biometrics : [];
  const items = biometrics.filter(isRecord);
  const fingerprints = items.filter((item) => String(item.type || "").toUpperCase() === "FINGERPRINT");
  const faces = items.filter((item) => String(item.type || "").toUpperCase() === "FACE");
  const selectedFingerprint = fingerprints.find((item) => Number(item.index) === fingerprintIndex) ?? null;
  const content = selectedFingerprint && typeof selectedFingerprint.content === "string" ? selectedFingerprint.content : "";

  return {
    faceCount: faces.length,
    fingerprintCount: fingerprints.length,
    selectedFingerprintContentLength: content.length,
    selectedFingerprintFormat:
      selectedFingerprint && typeof selectedFingerprint.format === "string" ? selectedFingerprint.format : null,
    selectedFingerprintPresent: Boolean(selectedFingerprint),
    status: payload && typeof payload.status === "string" ? payload.status : null,
    totalBiometrics: items.length,
  };
}

export async function runBiometricAttach(input: BiometricAttachInput): Promise<BiometricAttachExecution> {
  const startedAt = Date.now();
  const config = resolveConfig(input.config);
  const fingerprint = resolveFingerprintInput(input);
  const face = resolveFaceInput(input);
  const token = await obtainToken(config);
  const processId = await resolveProcessId(config, token, input);
  const preparedFingerprint = await buildFingerprintPayload(input, fingerprint.filePath);
  const faceBase64 = face ? fs.readFileSync(face.filePath).toString("base64") : null;

  const body = {
    data: [
      ...(faceBase64
        ? [
            {
              content: faceBase64,
              format: face?.format,
              index: face?.index,
              source: "ORIGINAL",
              type: "FACE",
            },
          ]
        : []),
      {
        content: preparedFingerprint.base64,
        format: preparedFingerprint.format,
        index: fingerprint.index,
        properties: { resolution: 500 },
        source: "ORIGINAL",
        type: "FINGERPRINT",
      },
    ],
  };

  const before = await fetchProcess(config, token, processId);
  const put = await attachBiometrics(config, token, processId, body);
  const after = await fetchProcess(config, token, processId);
  const beforeData = before.json?.data ?? null;
  const afterData = after.json?.data ?? null;
  const beforeSummary = summarizeProcessBiometrics(beforeData, fingerprint.index);
  const afterSummary = summarizeProcessBiometrics(afterData, fingerprint.index);
  const durationMs = Date.now() - startedAt;

  const generatedDir = ensureGeneratedDir(input.outputDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `attach-${stamp}-${processId}.json`;
  const outputPath = path.join(generatedDir, fileName);
  const latestOutputPath = path.join(generatedDir, "last-attach-result.json");

  const result: BiometricAttachExecution = {
    after: afterData,
    afterSummary,
    before: beforeData,
    beforeSummary,
    companySlug: input.companySlug?.trim() || null,
    durationMs,
    faceIncluded: Boolean(faceBase64),
    fingerprintBase64Length: preparedFingerprint.finalLength,
    fingerprintFormat: preparedFingerprint.format,
    fingerprintIndex: fingerprint.index,
    fingerprintLabel: fingerprint.label,
    host: config.host,
    latestOutputPath: toRelativeOutputPath(latestOutputPath),
    mode: preparedFingerprint.mode,
    outputPath: toRelativeOutputPath(outputPath),
    processId,
    putResponse: put.raw,
    putStatus: put.status,
    target: preparedFingerprint.target,
    user: config.user,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  fs.writeFileSync(latestOutputPath, JSON.stringify(result, null, 2));

  return result;
}
