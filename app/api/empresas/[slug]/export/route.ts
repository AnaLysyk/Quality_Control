import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getMockRole } from "@/lib/rbac/defects";
import { getCompanyQualitySummary, getCompanyDefects } from "@/lib/quality";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";
import { format } from "date-fns";

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  // Rate limit: 30 req/min per IP
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "unknown";
  const rate = await rateLimit(req, `empresas-export:${ip}`);
  if (rate.limited) return rate.response;
  const { slug } = await context.params;
  const mockRole = await getMockRole();
  const user = await authenticateRequest(req);
  if (SUPABASE_MOCK) {
    if (!mockRole) return new Response("Unauthorized", { status: 401 });
    if (mockRole !== "admin" && mockRole !== "company") return new Response("Forbidden", { status: 403 });
  } else {
    if (!user) return new Response("Unauthorized", { status: 401 });
    // Only allow global admin for now (backend AuthUser only has isGlobalAdmin)
    if (!user.isGlobalAdmin) return new Response("Forbidden", { status: 403 });
  }
  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") || "30d";
  const formatType = searchParams.get("format") || "csv";
  if (formatType !== "csv") return new Response("Formato não suportado", { status: 400 });

  // Dados já consolidados
  const summary = await getCompanyQualitySummary(slug, period);
  const defects = await getCompanyDefects(slug, period);

  // Cabeçalho
  const company = summary.companyName || slug;
  const now = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const userLabel = user?.email || mockRole || "admin";

  let csv = `company,period,quality_score,total_defects,open_defects,closed_defects,mttr_avg,sla_overdue,generated_at,user\n`;
  csv += `${company},${period},${summary.qualityScore},${summary.totalDefects},${summary.openDefects},${summary.closedDefects},${summary.mttrAvg},${summary.slaOverdue},${now},${userLabel}\n\n`;

  // Lista de defeitos
  csv += `id,title,origin,status,opened_at,closed_at,mttr_hours,run,severity\n`;
  for (const d of defects) {
    csv += `${d.id},${escapeCsv(d.title)},${d.origin},${d.status},${d.openedAt || ""},${d.closedAt || ""},${d.mttrHours || ""},${d.run || ""},${d.severity || ""}\n`;
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=quality-${slug}-${now.replace(/[: ]/g, "-")}.csv`,
    },
  });
}

function escapeCsv(val: string) {
  if (!val) return "";
  if (val.includes(",") || val.includes("\"")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
