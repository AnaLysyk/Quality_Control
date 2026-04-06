import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/lib/auth/session";
import {
  canManageInstitutionalCompanyAccess,
  resolveCurrentCompanyFromAccess,
} from "@/lib/companyProfileAccess";
import { uploadAndPersistCompanyLogo } from "@/lib/companyLogoUpload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const access = await getAccessContext(req);
    const { company, status } = await resolveCurrentCompanyFromAccess(access);

    if (!access) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }
    if (!company) {
      const message = status === 403 ? "Sem empresa vinculada" : "Empresa nao encontrada";
      return NextResponse.json({ error: message }, { status });
    }
    if (!canManageInstitutionalCompanyAccess(access)) {
      return NextResponse.json({ error: "Sem permissao para alterar o logo da empresa" }, { status: 403 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Formulario invalido" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 });
    }

    const { logoUrl } = await uploadAndPersistCompanyLogo(company.id, file);
    try {
      // Revalidate common server paths that might render company identity
      revalidatePath("/api/me");
      revalidatePath("/api/me/company-profile");
    } catch {
      // ignore revalidation errors
    }
    return NextResponse.json({ ok: true, logoUrl }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Nao foi possivel enviar o logo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
