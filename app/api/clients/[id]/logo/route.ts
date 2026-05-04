import { NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { uploadAndPersistCompanyLogo } from "@/lib/companyLogoUpload";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "Não autorizado" : "Sem permissão" }, { status });
    }

    const { id } = await params;
    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "ID da empresa invalido" }, { status: 400 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Formulario invalido" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }

    const { logoUrl } = await uploadAndPersistCompanyLogo(id.trim(), file);
    return NextResponse.json({ ok: true, logoUrl }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Não foi possível enviar o logo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
