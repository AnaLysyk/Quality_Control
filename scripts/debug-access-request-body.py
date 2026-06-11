from pathlib import Path

path = Path("app/api/access-requests/public/route.ts")
content = path.read_text(encoding="utf-8")

debug = '''  console.log("[ACCESS-REQUESTS][PUBLIC][BODY]", {
    keys: Object.keys(body),
    password: typeof body.password === "string" ? body.password : null,
    senha: typeof body.senha === "string" ? body.senha : null,
    plainPassword: typeof body.plainPassword === "string" ? body.plainPassword : null,
    companyDetails: body.companyDetails ?? null,
    company_name: body.company_name ?? null,
    company_tax_id: body.company_tax_id ?? null,
    website: body.website ?? null,
    linkedin: body.linkedin ?? null,
  });

'''

if '[ACCESS-REQUESTS][PUBLIC][BODY]' not in content:
    content = content.replace(
        '  const requesterEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";',
        debug + '  const requesterEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";',
        1,
    )

path.write_text(content, encoding="utf-8")
