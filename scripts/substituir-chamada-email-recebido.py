from pathlib import Path

path = Path("lib/accessRequestsV2/service.ts")
content = path.read_text(encoding="utf-8")

start_marker = "void emailService.sendAccessRequestReceivedEmail(requesterEmail, {"
end_marker = '}).catch((err: unknown) => console.error("[ACCESS-REQUESTS][V2][EMAIL][RECEIVED] failed", err));'

start = content.find(start_marker)
if start == -1:
    raise SystemExit("Não achei a chamada sendAccessRequestReceivedEmail no service.ts")

end = content.find(end_marker, start)
if end == -1:
    raise SystemExit("Não achei o final da chamada sendAccessRequestReceivedEmail no service.ts")

end = end + len(end_marker)

new_call = '''void emailService.sendAccessRequestReceivedEmail(requesterEmail, {
    name: requesterName || null,
    accessKey: created.accessKey ?? created.id,
    email: requesterEmail,
    phone: asText(payload.phone, 80) || asText(payload.requesterPhone, 80) || null,
    password: readTextFromPayload(payload, [
      "password",
      "senha",
      "plainPassword",
      "userPassword",
      "accessPassword",
      "requestPassword",
      "requestedPassword",
    ], 255) || requestedPassword || null,
    profileType: created.requestedRole ?? created.requestType,
    companyName:
      readTextFromPayload(readRecordFromPayload(payload.companyDetails), ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
      readTextFromPayload(payload, ["companyName", "company_name", "razaoSocial", "razao_social"], 255) ||
      null,
    title: asText(payload.title, 255) || null,
    description: reason ?? null,
    status: created.status,
    companyDetails: buildCompanyDetailsForEmail(payload),
  }).catch((err: unknown) => console.error("[ACCESS-REQUESTS][V2][EMAIL][RECEIVED] failed", err));'''

content = content[:start] + new_call + content[end:]

path.write_text(content, encoding="utf-8")
