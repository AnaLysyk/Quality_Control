import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const formData = await req.formData();
  const ticketId = formData.get("ticketId");
  const commentId = formData.get("commentId");
  const file = formData.get("file");
  if (!ticketId || !commentId || !file || typeof file !== "object" || !('arrayBuffer' in file)) {
    return NextResponse.json({ error: "ticketId, commentId e arquivo obrigatórios" }, { status: 400 });
  }
  const uploadDir = path.join(process.cwd(), "public", "uploads", companyId, ticketId.toString(), "comments", commentId.toString());
  await fs.mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  const url = `/uploads/${companyId}/${ticketId}/comments/${commentId}/${encodeURIComponent(file.name)}`;
  return NextResponse.json({ url });
}
