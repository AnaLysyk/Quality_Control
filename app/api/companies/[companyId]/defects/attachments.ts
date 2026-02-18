import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const formData = await req.formData();
  const defectId = formData.get("defectId");
  const file = formData.get("file");
  if (!defectId || !file || typeof file !== "object" || !('arrayBuffer' in file)) {
    return NextResponse.json({ error: "defectId e arquivo obrigatórios" }, { status: 400 });
  }
  const uploadDir = path.join(process.cwd(), "public", "uploads", companyId, defectId.toString());
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  const url = `/uploads/${companyId}/${defectId}/${encodeURIComponent(file.name)}`;
  return NextResponse.json({ url });
}
