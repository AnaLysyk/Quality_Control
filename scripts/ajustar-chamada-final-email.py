from pathlib import Path
import re

path = Path("lib/accessRequestsV2/service.ts")
content = path.read_text(encoding="utf-8")

# Garante que as variáveis existem imediatamente antes do envio
if "const passwordForReceivedEmail = readTextFromPayload(payload" not in content:
    content = content.replace(
        "void emailService.sendAccessRequestReceivedEmail(requesterEmail, {",
        """const passwordForReceivedEmail = readTextFromPayload(payload, [
    "password",
    "senha",
    "plainPassword",
    "userPassword",
    "accessPassword",
    "requestPassword",
    "requestedPassword",
  ], 255);

  const companyDetailsForReceivedEmail = buildCompanyDetailsForEmail(payload);

  void emailService.sendAccessRequestReceivedEmail(requesterEmail, {""",
        1,
    )

# Força password dentro da chamada real do e-mail
content = re.sub(
    r'password:\s*(?:[\s\S]*?)profileType:',
    '''password: passwordForReceivedEmail || requestedPassword || null,
    profileType:''',
    content,
    count=1,
)

# Força companyDetails dentro da chamada real do e-mail
content = re.sub(
    r'companyDetails:\s*(?:companyEmailDetails|companyDetailsForReceivedEmail|\{[\s\S]*?\n\s*\}),',
    '''companyDetails: companyDetailsForReceivedEmail,''',
    content,
    count=1,
)

path.write_text(content, encoding="utf-8")
