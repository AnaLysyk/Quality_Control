import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import { importBrainFileDocument } from "@/lib/brain/fileImport";
import { isBrainSourceStorageUnavailable } from "@/lib/brain/sourceSettings";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return NextResponse.json({ error: accessResult.error }, { status: accessResult.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo e obrigatorio" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `Arquivo maior que ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` }, { status: 400 });
    }

    const name = String(formData.get("name") ?? "").trim() || file.name;
    const scopeType = String(formData.get("scopeType") ?? "user");
    const companyId = formData.get("companyId");
    const projectId = formData.get("projectId");
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await importBrainFileDocument(accessResult.context, {
      name,
      fileName: file.name,
      buffer,
      mimeType: file.type,
      scopeType,
      companyId: typeof companyId === "string" && companyId.trim() ? companyId : null,
      projectId: typeof projectId === "string" && projectId.trim() ? projectId : null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isBrainSourceStorageUnavailable(error)) {
      return NextResponse.json({ error: "Tabelas de configuracao do Brain ainda nao existem." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Erro ao importar contexto";
    const status = /permissao/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
