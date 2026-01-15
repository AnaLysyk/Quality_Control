import "server-only";

import { NextResponse } from "next/server";

export type ApiMeta = {
  requestId: string;
  timestamp: string;
};

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  meta: ApiMeta;
};

export type ApiError = {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
  meta: ApiMeta;
};

function nowIso() {
  return new Date().toISOString();
}

function generateRequestId(): string {
  const anyCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `req_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function shouldLog() {
  return process.env.NODE_ENV !== "test" && !process.env.JEST_WORKER_ID;
}

export function getRequestId(req: Request): string {
  return (
    req.headers.get("x-request-id")?.trim() ||
    req.headers.get("x-vercel-id")?.trim() ||
    generateRequestId()
  );
}

export function apiOk<T>(
  req: Request,
  data: T,
  message = "OK",
  init?: {
    status?: number;
    route?: string;
    extra?: Record<string, unknown>;
  },
) {
  const requestId = getRequestId(req);
  const route = init?.route ?? new URL(req.url).pathname;
  const payload: ApiSuccess<T> & Record<string, unknown> = {
    success: true,
    message,
    data,
    meta: { requestId, timestamp: nowIso() },
    ...(init?.extra ?? {}),
  };

  const status = init?.status ?? 200;
  if (shouldLog()) {
    console.info(`[api] ${route} ${status} requestId=${requestId}`);
  }

  const res = NextResponse.json(payload, { status });
  res.headers.set("x-request-id", requestId);
  return res;
}

export function apiFail(
  req: Request,
  message: string,
  init: {
    status: number;
    code: string;
    details?: unknown;
    route?: string;
    extra?: Record<string, unknown>;
  },
) {
  const requestId = getRequestId(req);
  const route = init.route ?? new URL(req.url).pathname;

  const payload: ApiError & Record<string, unknown> = {
    success: false,
    message,
    error: {
      code: init.code,
      details: init.details,
    },
    meta: { requestId, timestamp: nowIso() },
    ...(init.extra ?? {}),
  };

  const status = init.status;
  if (shouldLog()) {
    const log = status >= 500 ? console.error : console.warn;
    log(`[api] ${route} ${status} requestId=${requestId} code=${init.code}`, init.details ?? "");
  }

  const res = NextResponse.json(payload, { status });
  res.headers.set("x-request-id", requestId);
  return res;
}
