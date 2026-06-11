from pathlib import Path
import re

# Corrige qualquer join quebrado no lib/email.ts
email_path = Path("lib/email.ts")
email = email_path.read_text(encoding="utf-8")

email = re.sub(
    r'const permissionsText = contentByRole\.permissions\.map\(\(item\) => `- \$\{item\}`\)\.join\("\s*"\);',
    'const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("\\\\n");',
    email,
)

email_path.write_text(email, encoding="utf-8")


# Melhora log/retorno da rota CNPJ
route_path = Path("app/api/public/company-lookup/cnpj/route.ts")
route_path.write_text('''import { NextResponse } from "next/server";
import { lookupCompanyByCnpj } from "@/lib/company-lookup/companyLookup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cnpj = searchParams.get("cnpj") ?? "";

  try {
    const item = await lookupCompanyByCnpj(cnpj);

    return NextResponse.json({
      ok: true,
      item,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível consultar o CNPJ.";

    console.error("[COMPANY LOOKUP][CNPJ]", {
      cnpj,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        message,
        cnpj,
      },
      { status: 400 },
    );
  }
}
''', encoding="utf-8")
