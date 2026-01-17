type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
  is_global_admin?: boolean;
};

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ThreadRow = {
  id: string;
  created_by: string;
  messages: MessageRow[];
};

const denoEnvGet = (key: string): string | undefined => {
  const deno = (globalThis as any).Deno;
  return deno?.env?.get?.(key);
};

const SUPABASE_URL = denoEnvGet("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = denoEnvGet("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_KEY = denoEnvGet("OPENAI_API_KEY");
const RATE_WINDOW_SECONDS = Number(denoEnvGet("SUMMARY_RATE_WINDOW") ?? "60");
const FALLBACK_MESSAGE_LIMIT = Number(denoEnvGet("SUMMARY_FALLBACK_LIMIT") ?? "5");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Configuração do Supabase ausente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias");
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
  });
}

function serviceHeaders(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY!,
  };

  return extra ? { ...base, ...extra } : base;
}

async function verifyJwt(req: Request): Promise<SupabaseUser | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as SupabaseUser;
  return payload?.id ? payload : null;
}

function isAdmin(user: SupabaseUser | null): boolean {
  if (!user) return false;
  if (user.is_global_admin) return true;
  const metadata = user.user_metadata ?? {};
  return metadata?.role === "admin" || metadata?.is_global_admin === true;
}

async function getRateLimitLastHit(key: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/rate_limiter?select=last_hit&key=eq.${encodeURIComponent(key)}&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ last_hit?: string }>;
  return rows?.[0]?.last_hit ?? null;
}

async function upsertRateLimit(key: string, lastHit: string) {
  const url = `${SUPABASE_URL}/rest/v1/rate_limiter?on_conflict=key`;
  await fetch(url, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({ key, last_hit: lastHit }),
  });
}

async function cleanupRateLimit(windowStart: string) {
  const url = `${SUPABASE_URL}/rest/v1/rate_limiter?last_hit=lt.${encodeURIComponent(windowStart)}`;
  await fetch(url, { method: "DELETE", headers: serviceHeaders() });
}

async function checkRateLimit(userId: string, threadId: string, skip: boolean) {
  if (skip) return { allowed: true } as const;

  const windowStart = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const key = `${userId}:${threadId}`;

  const lastHit = await getRateLimitLastHit(key);
  if (lastHit && lastHit >= windowStart) {
    const retryAfter = Math.ceil((Date.parse(lastHit) + RATE_WINDOW_SECONDS * 1000 - Date.now()) / 1000);
    return { allowed: false as const, retryAfter: Math.max(retryAfter, 1) };
  }

  await upsertRateLimit(key, nowIso);
  await cleanupRateLimit(windowStart);
  return { allowed: true } as const;
}

async function fetchThread(threadId: string): Promise<ThreadRow | null> {
  const url = `${SUPABASE_URL}/rest/v1/threads?id=eq.${encodeURIComponent(threadId)}&select=id,created_by,messages(id,sender_id,content,created_at)&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error("Falha ao buscar thread");
  const rows = (await res.json()) as ThreadRow[];
  return rows?.[0] ?? null;
}

function ensureAuthorized(thread: ThreadRow | null, user: SupabaseUser | null): boolean {
  if (!thread || !user) return false;
  if (thread.created_by === user.id) return true;
  return thread.messages?.some((message) => message.sender_id === user.id) ?? false;
}

async function buildSummary(messages: MessageRow[]): Promise<{ summary: string; model: string }>{
  if (!messages.length) return { summary: "Conversação vazia.", model: "none" };

  if (!OPENAI_KEY) {
    const tail = messages.slice(-FALLBACK_MESSAGE_LIMIT);
    return {
      summary: tail.map((msg) => `• ${msg.sender_id}: ${msg.content}`).join("\n"),
      model: "fallback:last-messages",
    };
  }

  const prompt = `Resuma a conversa a seguir em português. Forneça (1) duas a quatro frases destacando o contexto geral e (2) uma lista curta de pontos-chave.\n\n${messages
    .map((msg, index) => `${index + 1}. [${msg.created_at}] ${msg.sender_id}: ${msg.content}`)
    .join("\n")}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um assistente que resume conversas para equipes de QA." },
        { role: "user", content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha na requisição à OpenAI: ${resp.status} ${txt}`);
  }

  const json = (await resp.json()) as any;
  const summary = String(json?.choices?.[0]?.message?.content ?? "").trim();
  return { summary: summary || "Resumo indisponível.", model: "openai:gpt-4o-mini" };
}

async function storeSummary(threadId: string, summary: string, userId: string, model: string) {
  const url = `${SUPABASE_URL}/rest/v1/message_summaries`;
  const res = await fetch(url, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ thread_id: threadId, summary_text: summary, model, created_by: userId }),
  });
  if (!res.ok) throw new Error("Falha ao gravar registro");
  const created = (await res.json()) as Array<{ id?: string }>;
  return created?.[0]?.id ?? null;
}

const serve = (globalThis as any).Deno?.serve as ((handler: (req: Request) => Response | Promise<Response>) => void) | undefined;
if (!serve) {
  throw new Error("Deno.serve não está disponível neste runtime");
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Método não permitido" }, 405);
    }

    const user = await verifyJwt(req);
    if (!user) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const { thread_id: threadId, max_messages: maxMessages } = await req.json().catch(() => ({ thread_id: null }));
    if (!threadId || typeof threadId !== "string") {
      return jsonResponse({ error: "thread_id é obrigatório" }, 400);
    }

    const thread = await fetchThread(threadId);
    if (!thread) {
      return jsonResponse({ error: "Thread não encontrada" }, 404);
    }

    const admin = isAdmin(user);
    if (!ensureAuthorized(thread, user) && !admin) {
      return jsonResponse({ error: "Acesso proibido" }, 403);
    }

    const rate = await checkRateLimit(user.id, threadId, admin);
    if (!rate.allowed) {
      return jsonResponse({ error: "Muitas requisições", retry_after: rate.retryAfter }, 429);
    }

    const sortedMessages = [...(thread.messages ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, typeof maxMessages === "number" && maxMessages > 0 ? maxMessages : undefined);

    if (!sortedMessages.length) {
      return jsonResponse({ error: "Não há mensagens nesta thread" }, 404);
    }

    const { summary, model } = await buildSummary(sortedMessages);
    const id = await storeSummary(threadId, summary, user.id, model);

    return jsonResponse({ id, thread_id: threadId, created_by: user.id, summary, model }, 200);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
