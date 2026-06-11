from pathlib import Path
import re

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8-sig")

# Remove qualquer testid antigo duplicado
content = content.replace('                data-testid="open-request-access-form-button"\n', "")
content = content.replace('              data-testid="open-request-access-form-button"\n', "")

# Coloca somente no botão que abre criação
pattern = r'(<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => \{\s*\n\s*setIsRequestOpen\(true\);)'

replacement = r'<button\n                data-testid="open-request-access-form-button"\n                type="button"\n                onClick={() => {\n                  setIsRequestOpen(true);'

content, count = re.subn(pattern, replacement, content, count=1)

if count != 1:
    raise SystemExit("Não consegui encontrar o botão com setIsRequestOpen(true).")

path.write_text(content, encoding="utf-8")
