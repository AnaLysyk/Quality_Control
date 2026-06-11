from pathlib import Path
import re

logo_public_path = "/logo-tc.png"

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

# Adiciona função para resolver URL pública do logo
if "private resolveEmailLogoUrl()" not in content:
    content = re.sub(
        r'(  private resolvePublicBaseUrl\(\) \{[\s\S]*?  \}\n)',
        r'''\1
  private resolveEmailLogoUrl() {
    const configured =
      process.env.EMAIL_LOGO_URL ||
      process.env.NEXT_PUBLIC_EMAIL_LOGO_URL ||
      "";
    if (configured.trim()) return configured.trim();

    return `${this.resolvePublicBaseUrl()}/logo-tc.png`;
  }
''',
        content,
        count=1,
    )

logo_img = '<img src="${this.resolveEmailLogoUrl()}" alt="Testing Company" style="display:block;margin:0 auto 10px;max-width:150px;height:auto;border:0;" />'

# Troca blocos/pílulas com texto Testing Company por imagem do logo
content = re.sub(
    r'<div([^>]*)>\s*(?:🏢\s*)?Testing Company\s*</div>',
    lambda m: f'<div{m.group(1)}>{logo_img}</div>',
    content,
)

content = re.sub(
    r'<span([^>]*)>\s*(?:🏢\s*)?Testing Company\s*</span>',
    lambda m: f'<span{m.group(1)}>{logo_img}</span>',
    content,
)

# Se tiver badge simples no template novo
content = content.replace(
    '<div class="brand-badge">Testing Company</div>',
    f'<div class="brand-badge">{logo_img}</div>',
)

content = content.replace("/logo-tc.png", logo_public_path)

path.write_text(content, encoding="utf-8")
