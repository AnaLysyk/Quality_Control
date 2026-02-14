import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";

const ASSISTANT_ENABLED = process.env.AI_ASSISTANT_ENABLED !== "false";
const MAX_MESSAGE_LENGTH = (() => {
  const raw = Number.parseInt(process.env.AI_ASSISTANT_MAX_CHARS ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return Math.min(raw, 8000);
  return 2000;
})();
const REQUEST_TIMEOUT_MS = (() => {
  const raw = Number.parseInt(process.env.AI_ASSISTANT_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(raw) && raw >= 1000) return raw;
  return 15000;
})();

type AssistantRole = "user" | "assistant" | "system";
type AssistantHistoryEntry = { role: AssistantRole; content: string };

function resolveAssistantUrl(): string | null {
  const raw = (process.env.AI_ASSISTANT_AGENT_URL ?? process.env.AI_ASSISTANT_URL ?? "").trim();
  if (raw) return raw;
  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:8000/agent/chat";
  }
  return null;
}

function sanitizeHistory(value: unknown): AssistantHistoryEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set<AssistantRole>(["user", "assistant", "system"]);
  const items: AssistantHistoryEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const roleRaw = (entry as { role?: unknown }).role;
    const contentRaw = (entry as { content?: unknown }).content;
    if (typeof roleRaw !== "string" || typeof contentRaw !== "string") continue;
    const role = roleRaw.trim().toLowerCase();
    const content = contentRaw.trim();
    if (!allowed.has(role as AssistantRole) || content.length === 0) continue;
    items.push({ role: role as AssistantRole, content });
    if (items.length >= 12) break;
  }
  return items.length > 0 ? items : undefined;
}

export async function POST(req: Request) {
  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ error: "Assistente desativado" }, { status: 410 });
  }

  const assistantUrl = resolveAssistantUrl();
  if (!assistantUrl) {
    return NextResponse.json({ error: "Assistente indisponivel" }, { status: 503 });
  }

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Corpo obrigatorio" }, { status: 400 });
  }

  const body = parsed as Record<string, unknown>;
  const rawMessage = body.message;
  if (typeof rawMessage !== "string") {
    return NextResponse.json({ error: "Mensagem obrigatoria" }, { status: 422 });
  }

  const message = rawMessage.trim();
  if (message.length === 0) {
    return NextResponse.json({ error: "Mensagem obrigatoria" }, { status: 422 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Mensagem muito longa" }, { status: 422 });
  }

  const history = sanitizeHistory(body.history);
  const sessionRaw = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const sessionId = sessionRaw.length > 0 ? sessionRaw.slice(0, 64) : authUser.id;

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    message,
    history,
    context: {
      user: {
        id: authUser.id,
        email: authUser.email,
        role: authUser.role ?? null,
        companyId: authUser.companyId ?? null,
        companySlug: authUser.companySlug ?? null,
        companySlugs: authUser.companySlugs ?? [],
      },
    },
  };
  if (!history) {
    delete payload.history;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(assistantUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      let detail: unknown;
      try {
        detail = await response.json();
      } catch {
        detail = await response.text().catch(() => null);
      }
      console.error("assistant request failed", response.status, detail);
      const status = response.status >= 400 && response.status < 500 ? 502 : 503;
      return NextResponse.json({ error: "Falha ao obter resposta do assistente" }, { status });
    }

    const data = (await response.json().catch(() => null)) as { reply?: unknown } | null;
    const reply = typeof data?.reply === "string" ? data.reply : null;
    if (!reply) {
      return NextResponse.json({ error: "Resposta invalida do assistente" }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Tempo limite do assistente" }, { status: 504 });
    }
    console.error("assistant request error", error);
    return NextResponse.json({ error: "Assistente indisponivel" }, { status: 503 });
  }
}
