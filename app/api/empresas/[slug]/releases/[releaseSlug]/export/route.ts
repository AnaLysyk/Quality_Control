import { NextResponse } from "next/server";
import { generateRunPdf } from "@/lib/runPdfGenerator";
import { getRunDetailViewModel } from "@/lib/runDetailViewModel";

function buildCsv(vm: {
  displayTitle: string;
  projectCode: string;
  source: string;
  stats: { pass: number; fail: number; blocked: number; notRun: number };
  total: number;
  gate: { status: string };
  qualityScore: number;
}) {
  const rows = [
    ["Titulo", vm.displayTitle],
    ["Projeto", vm.projectCode],
    ["Origem", vm.source],
    ["Pass", String(vm.stats.pass)],
    ["Fail", String(vm.stats.fail)],
    ["Blocked", String(vm.stats.blocked)],
    ["Not Run", String(vm.stats.notRun)],
    ["Total", String(vm.total)],
    ["Gate", vm.gate.status],
    ["Score", String(vm.qualityScore)],
  ];
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

export async function GET(req: Request, context: { params: Promise<{ slug: string; releaseSlug: string }> }) {
  const { slug, releaseSlug } = await context.params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();
  const safeFormat = format === "pdf" ? "pdf" : "csv";
  const filename = `release-${releaseSlug}.${safeFormat}`;

  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Cache-Control", "no-store");

  if (safeFormat === "pdf") {
    const pdfBuffer = await generateRunPdf(slug, releaseSlug);
    if (!pdfBuffer) {
      return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
    }
    headers.set("Content-Type", "application/pdf");
    return new NextResponse(new Uint8Array(pdfBuffer), { headers });
  }

  // CSV
  const vm = await getRunDetailViewModel(releaseSlug, slug !== "demo" ? slug : undefined);
  if (!vm) {
    return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
  }
  headers.set("Content-Type", "text/csv; charset=utf-8");
  return new NextResponse(buildCsv(vm), { headers });
}

