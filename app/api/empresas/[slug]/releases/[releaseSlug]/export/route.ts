import { NextResponse } from "next/server";

function buildCsv(slug: string) {
  return `release,${slug}\nstatus,ok\n`;
}

function buildPdf(slug: string) {
  return `%PDF-1.4\n% Relatorio ${slug}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string; releaseSlug: string }> }) {
  const { releaseSlug } = await context.params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();
  const safeFormat = format === "pdf" ? "pdf" : "csv";
  const filename = `release-${releaseSlug}.${safeFormat}`;

  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename=\"${filename}\"`);
  headers.set("Content-Type", safeFormat === "pdf" ? "application/pdf" : "text/csv; charset=utf-8");

  const body = safeFormat === "pdf" ? buildPdf(releaseSlug) : buildCsv(releaseSlug);
  return new NextResponse(body, { headers });
}
