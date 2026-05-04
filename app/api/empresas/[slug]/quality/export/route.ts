import { NextResponse } from "next/server";
import { getCompanyQualitySummary, getCompanyDefectsExport } from "@/lib/companyQuality";

function toCsvLine(values: Array<string | number | null | undefined>) {
  return values.map((value) => {
    if (value == null) return "";
    const text = String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/\"/g, "\"\"")}"`;
    }
    return text;
  }).join(",");
}

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const summary = await getCompanyQualitySummary(slug);
  const defects = await getCompanyDefectsExport(slug);

  const lines: string[] = [];
  lines.push("company,period,quality_score");
  lines.push(toCsvLine([slug, "30d", summary.qualityScore]));
  lines.push("");
  lines.push("id,title,origin,status,opened_at");

  defects.forEach((defect) => {
    lines.push(
      toCsvLine([defect.id, defect.title, defect.origin, defect.status, defect.openedAt]),
    );
  });

  const csv = `${lines.join("\n")}\n`;
  const headers = new Headers();
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set("Content-Disposition", `attachment; filename=\"quality-${slug}.csv\"`);

  return new NextResponse(csv, { headers });
}
