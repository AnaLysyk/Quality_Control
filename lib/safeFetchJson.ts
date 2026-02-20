export type SafeFetchError = {
  status: number;
  message: string;
  details?: string;
};

export class SafeFetchJsonError extends Error {
  status: number;
  details?: string;

  constructor(err: SafeFetchError) {
    super(err.message);
    this.name = "SafeFetchJsonError";
    this.status = err.status;
    this.details = err.details;
  }
}

type SafeFetchJsonOptions = RequestInit & {
  /**
   * Se true, adiciona cache: "no-store" automaticamente
   * (bom pra telas que precisam sempre do dado mais recente)
   */
  noStore?: boolean;

  /**
   * Opcional: transforma o erro em uma mensagem custom (ex: "Não foi possível carregar suportes")
   */
  friendlyMessage?: string;
};

function pickPreview(text: string, limit = 400) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned;
}

export async function safeFetchJson<T>(
  input: RequestInfo | URL,
  options?: SafeFetchJsonOptions,
): Promise<T> {
  const { noStore, friendlyMessage, ...init } = options ?? {};

  const res = await fetch(input, {
    ...init,
    cache: noStore ? "no-store" : init.cache,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const contentType = res.headers.get("content-type") ?? "";

  // Se não OK, tenta extrair um erro curto sem vazar HTML gigante
  if (!res.ok) {
    let details: string | undefined;

    try {
      if (contentType.includes("application/json")) {
        const j = (await res.json()) as any;
        details = typeof j?.error === "string" ? j.error : JSON.stringify(j);
      } else {
        const t = await res.text();
        details = pickPreview(t);
      }
    } catch {
      // ignora
    }

    throw new SafeFetchJsonError({
      status: res.status,
      message: friendlyMessage ?? `Falha na requisição (${res.status})`,
      details,
    });
  }

  // OK mas não é JSON? Isso é exatamente o caso do 404 HTML.
  if (!contentType.includes("application/json")) {
    let details: string | undefined;
    try {
      const t = await res.text();
      details = pickPreview(t);
    } catch {
      // ignora
    }

    throw new SafeFetchJsonError({
      status: 500,
      message: friendlyMessage ?? "Resposta inesperada (não é JSON). Verifique o endpoint.",
      details,
    });
  }

  return (await res.json()) as T;
}
