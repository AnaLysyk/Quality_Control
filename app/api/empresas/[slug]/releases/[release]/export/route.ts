import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getMockRole } from "@/lib/rbac/defects";
import { getReleaseTimeline } from "@/lib/releaseTimeline";
// Importa fs e path só em ambiente Node/server
let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}
import { format } from "date-fns";

const GATE_STORE = path && path.join(process.cwd(), "data", "quality_gate_history.json");

async function ensureGateStore() {
  if (!fs || !path || !GATE_STORE) return;
  await fs.mkdir(path.dirname(GATE_STORE), { recursive: true });
  try {
    await fs.access(GATE_STORE);
  } catch {
    await fs.writeFile(GATE_STORE, "[]", "utf8");
  }
}

async function readGateHistory() {
  if (!fs || !GATE_STORE) return [];
  await ensureGateStore();
  const raw = await fs.readFile(GATE_STORE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeCsv(val: string) {
  if (!val) return "";
  if (val.includes(",") || val.includes("\"")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Buffer {
  const safeLines = lines.length ? lines : ["Export vazio"];
  const contentLines = safeLines
    .map((line, idx) => {
      const y = 780 - idx * 16;
      return `BT /F1 12 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  objects.push("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj");
  objects.push(`4 0 obj << /Length ${contentLines.length} >> stream
${contentLines}
endstream endobj`);
  objects.push("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");

  let pdf = "%PDF-1.4\n";
  const xref: number[] = [];
  objects.forEach((obj) => {
    xref.push(pdf.length);
    pdf += obj + "\n";
  });

  const xrefStart = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  xref.forEach((pos) => {
    pdf += `${pos.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += "trailer << /Size " + (objects.length + 1) + " /Root 1 0 R >>\n";
  pdf += "startxref\n";
  pdf += xrefStart + "\n";
  pdf += "%%EOF";

  return Buffer.from(pdf, "utf8");
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string; release: string }> }) {
  const { slug: companySlug, release: releaseSlug } = await context.params;
  const formatType = req.nextUrl.searchParams.get("format") || "csv";

  const user = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const normalizedRole = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const isAdmin = user?.isGlobalAdmin || normalizedRole === "admin" || mockRole === "admin";
  const isCompany = normalizedRole === "company" || mockRole === "company";
  if (!isAdmin && !isCompany) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateHistory = await readGateHistory();
  const filteredHistory = gateHistory
    .filter((entry: any) => entry.company_slug === companySlug && entry.release_slug === releaseSlug)
    .sort((a: any, b: any) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)));
  const latestGate = filteredHistory[0] || null;

  const timeline = await getReleaseTimeline(companySlug, releaseSlug);
  const generatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const fileNameBase = `release-${releaseSlug}-${generatedAt.replace(/[: ]/g, "-")}`;

  if (formatType === "pdf") {
    const lines: string[] = [];
    lines.push("Resumo da Release");
    lines.push(`Empresa: ${companySlug}`);
    lines.push(`Release: ${releaseSlug}`);
    lines.push(`Gerado em: ${generatedAt}`);
    lines.push("");
    lines.push("Quality Gate");
    lines.push(`Status: ${latestGate?.gate_status ?? "-"}`);
    lines.push(`Decisao: ${latestGate?.decision ?? latestGate?.gate_status ?? "-"}`);
    if (latestGate?.reasons?.length) lines.push(`Motivos: ${(latestGate.reasons as string[]).join(" | ")}`);
    if (latestGate?.override) {
      lines.push(`Override por ${latestGate.override.by} em ${latestGate.override.at} — ${latestGate.override.reason}`);
    }
    lines.push("");
    lines.push("Metricas");
    lines.push(`MTTR (h): ${latestGate?.mttr_hours ?? "-"}`);
    lines.push(`Defeitos abertos: ${latestGate?.open_defects ?? "-"}`);
    lines.push(`Fail rate (%): ${latestGate?.fail_rate ?? "-"}`);
    lines.push("");
    lines.push("Timeline");
    timeline.forEach((evt) => {
      lines.push(`${evt.occurred_at} - ${evt.label}`);
    });

    const pdfBuffer = buildSimplePdf(lines);
    const pdfBytes = new Uint8Array(pdfBuffer);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${fileNameBase}.pdf`,
      },
    });
  }

  // Default: CSV
  let csv = "section,key,value\n";
  csv += `summary,company,${companySlug}\n`;
  csv += `summary,release,${releaseSlug}\n`;
  csv += `summary,generated_at,${generatedAt}\n`;
  csv += "\n";
  const decision = latestGate?.decision ?? latestGate?.gate_status ?? "";
  csv += "quality_gate,key,value\n";
  csv += `quality_gate,status,${latestGate?.gate_status ?? ""}\n`;
  csv += `quality_gate,decision,${decision}\n`;
  if (latestGate?.reasons?.length) {
    csv += `quality_gate,reasons,${(latestGate.reasons as string[]).join(" | ")}\n`;
  }
  if (latestGate?.override) {
    csv += `quality_gate,override_by,${latestGate.override.by}\n`;
    csv += `quality_gate,override_reason,${latestGate.override.reason}\n`;
    csv += `quality_gate,override_at,${latestGate.override.at}\n`;
  }
  csv += "\n";

  csv += "metrics,key,value\n";
  csv += `metrics,mttr_hours,${latestGate?.mttr_hours ?? ""}\n`;
  csv += `metrics,open_defects,${latestGate?.open_defects ?? ""}\n`;
  csv += `metrics,fail_rate,${latestGate?.fail_rate ?? ""}\n`;
  csv += "\n";

  csv += "timeline,type,label,occurred_at\n";
  timeline.forEach((evt) => {
    csv += `timeline,${evt.type},${escapeCsv(evt.label)},${evt.occurred_at}\n`;
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${fileNameBase}.csv`,
    },
  });
}
