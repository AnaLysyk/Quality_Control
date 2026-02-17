// Minimal type declarations for lib/apiEnvelope
export function extractMessageFromJson(json: unknown): string | null;
export function extractRequestIdFromJson(json: unknown): string | null;
export function formatMessageWithRequestId(msg: string, requestId: string | null): string;
export function unwrapEnvelopeData<T = unknown>(data: unknown): T | null;
