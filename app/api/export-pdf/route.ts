import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function sanitizeName(value: string) {
  const trimmed = value.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
  return trimmed.length ? trimmed.slice(0, 120) : "relatorio";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawName = searchParams.get("fileName") ?? "relatorio";
  const fileName = sanitizeName(rawName);
  const filler = "X".repeat(2000);
  const content = `PDF_EXPORT_PLACEHOLDER\nArquivo: ${fileName}\n${filler}\n`;
  const buffer = Buffer.from(content, "utf8");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${fileName}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}
