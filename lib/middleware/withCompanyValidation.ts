import { authenticateRequest } from "@/lib/jwtAuth";
import { assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import type { AuthUser } from "@/lib/jwtAuth";

type HandlerFn = (user: AuthUser, companyId: string, req: Request) => Promise<Response> | Response;

export function withCompanyValidation(handler: HandlerFn) {
  return async function wrappedHandler(req: Request): Promise<Response> {
    const user = await authenticateRequest(req);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    let companyId: string | null = null;
    try {
      const method = (req.method ?? "").toUpperCase();
      const url = new URL(req.url);
      if (method === "GET") {
        companyId = url.searchParams.get("companyId");
      } else if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        // Read raw text to avoid consuming the request body stream permanently.
        const raw = await req.text().catch(() => "");
        let body: Record<string, unknown> | null = null;
        if (raw && raw.length) {
          try {
            body = JSON.parse(raw) as Record<string, unknown>;
          } catch (e) {
            body = null;
          }
        }
        companyId = (body && typeof body.companyId === "string") ? body.companyId : null;
        // Rebuild the request to pass the original body downstream to the handler.
        // If there was no raw body, keep the original request.
        if (raw && raw.length) {
          req = new Request(req.url, {
            method: req.method,
            headers: req.headers as any,
            body: raw,
            duplex: (req as any).duplex,
          });
        }
        // fallback: if body doesn't contain companyId, use user's primary companyId
        if (!companyId && typeof user.companyId === "string" && user.companyId.length > 0) {
          companyId = user.companyId;
        }
      }

      if (!companyId) throw new Error("MISSING_COMPANY_ID");
      assertCompanyAccess(user, companyId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "MISSING_COMPANY_ID") {
        return new Response(JSON.stringify({ error: "companyId ausente" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if (message === "FORBIDDEN_COMPANY_ACCESS") {
        return new Response(JSON.stringify({ error: "Sem acesso à empresa" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erro inesperado" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return await handler(user, companyId!, req);
  };
}
