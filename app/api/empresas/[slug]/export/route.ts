import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { getCompanyQualitySummary, getCompanyDefects } from "@/lib/quality";
import { format } from "date-fns";

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isAdminOrCompany(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "company" || role === "global_admin";
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "unknown";
  const rate = await rateLimit(req, `empresas-export:${ip}`);
  if (rate.limited) return rate.response;
  const { slug } = await context.params;

  const user = await authenticateRequest(req);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!isAdminOrCompany(user)) return new Response("Forbidden", { status: 403 });

  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") || "30d";
  const formatType = searchParams.get("format") || "csv";
  if (formatType !== "csv") return new Response("Formato nao suportado", { status: 400 });

  const summary = await getCompanyQualitySummary(slug, period);
  const defects = await getCompanyDefects(slug, period);

  const company = summary.companyName || slug;
  const now = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const userLabel = user.email || "admin";

  let csv = `company,period,quality_score,total_defects,open_defects,closed_defects,mttr_avg,sla_overdue,generated_at,user\n`;
  csv += `${company},${period},${summary.qualityScore},${summary.totalDefects},${summary.openDefects},${summary.closedDefects},${summary.mttrAvg},${summary.slaOverdue},${now},${userLabel}\n\n`;

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
