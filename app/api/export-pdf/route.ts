import { NextRequest, NextResponse } from "next/server";
import { generateRunPdf } from "@/lib/runPdfGenerator";

export const runtime = "nodejs";

function sanitizeName(value: string) {
  const trimmed = value.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
  return trimmed.length ? trimmed.slice(0, 120) : "relatorio";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawName = searchParams.get("fileName") ?? "relatorio";
  const fileName = sanitizeName(rawName);
  const companySlug = searchParams.get("company") ?? "demo";

  // Try to generate a real PDF from the release slug
  const pdfBuffer = await generateRunPdf(companySlug, rawName).catch(() => null);

  if (pdfBuffer) {
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Fallback: generate a minimal placeholder PDF via jsPDF
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFontSize(14);
  pdf.text(`Relatório ${fileName}`, 20, 30);
  pdf.setFontSize(10);
  pdf.text("Run não encontrada ou dados indisponíveis.", 20, 42);
  const fallbackBuffer = Buffer.from(pdf.output("arraybuffer"));

  return new NextResponse(fallbackBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
