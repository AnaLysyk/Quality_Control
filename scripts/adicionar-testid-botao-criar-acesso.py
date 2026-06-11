from pathlib import Path

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8-sig")

old = '''              <button
                type="button"
                onClick={() => {
                  setIsRequestOpen(true);'''

new = '''              <button
                data-testid="open-request-access-form-button"
                type="button"
                onClick={() => {
                  setIsRequestOpen(true);'''

if old not in content:
    raise SystemExit("Não achei o botão de criar solicitação para adicionar data-testid.")

content = content.replace(old, new, 1)

path.write_text(content, encoding="utf-8")
