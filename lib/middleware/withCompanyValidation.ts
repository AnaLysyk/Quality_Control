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
        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        companyId = (body && typeof body.companyId === "string") ? body.companyId : null;
        // fallback: if body doesn't contain companyId, use user's primary companyId
        if (!companyId && typeof user.companyId === "string" && user.companyId.length > 0) {
          companyId = user.companyId;
        }
      }

      if (!companyId) throw new Error("MISSING_COMPANY_ID");
      await assertCompanyAccess(user, companyId);
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
