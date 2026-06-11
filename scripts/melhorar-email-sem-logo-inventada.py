from pathlib import Path
import re

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

# Remove logo inventada QC do HTML do e-mail aprovado
content = content.replace(
'''        <div class="logo"><span>QC</span></div>
        <h1>Quality Control</h1>
        <p>${contentByRole.title}</p>''',
'''        <div class="brand">Testing Company</div>
        <h1>Quality Control</h1>
        <p>${contentByRole.title}</p>'''
)

# Remove CSS da logo QC e adiciona brand textual
content = re.sub(
    r'''\s*\.logo\{[^}]*\}
\s*\.logo span\{[^}]*\}''',
    '''
    .brand{display:inline-block;margin:0 auto 14px;padding:8px 16px;border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:13px;font-weight:800;letter-spacing:.2px}''',
    content,
)

# Deixa o e-mail mais largo e profissional
content = content.replace(
    ".card{max-width:660px;",
    ".card{max-width:760px;"
)

content = content.replace(
    ".content{padding:34px 32px 28px}",
    ".content{padding:42px 44px 34px}"
)

content = content.replace(
    ".header{background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff;padding:38px 32px;text-align:center}",
    ".header{background:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:44px 40px;text-align:center}"
)

content = content.replace(
    ".button{display:inline-block;padding:15px 30px;",
    ".button{display:inline-block;padding:16px 36px;"
)

content = content.replace(
    "font-size:14px;box-shadow:0 12px 24px rgba(239,0,1,.22)}",
    "font-size:15px;box-shadow:0 14px 28px rgba(239,0,1,.28)}"
)

# Ajusta fundo para ficar menos blocado no Gmail
content = content.replace(
    ".page{width:100%;padding:32px 12px;background:linear-gradient(135deg,#011848 0%,#f4f6fb 52%,#ef0001 100%)}",
    ".page{width:100%;padding:40px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}"
)

path.write_text(content, encoding="utf-8")
