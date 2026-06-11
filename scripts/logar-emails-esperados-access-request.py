from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

old = '''      const unique = Date.now();
      const requestEmail = buildUniqueEmail(profile.value, unique);'''

new = '''      const unique = Date.now();
      const requestEmail = buildUniqueEmail(profile.value, unique);

      console.log("[ACCESS REQUEST EXPECTED EMAIL]", {
        profile: profile.label,
        email: requestEmail,
      });'''

if old not in content:
    raise SystemExit("Não achei o ponto do requestEmail.")

content = content.replace(old, new, 1)

path.write_text(content, encoding="utf-8")
