from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-approval-login-profile.ui.spec.ts")
content = path.read_text(encoding="utf-8")

content = content.replace(
'''  return {
    requestId: json.item!.id!,
    email,
    fullName,
    title,
    description,
  };''',
'''  return {
    requestId: json.item!.id!,
    email,
    fullName,
    title,
    description,
    role: "Analista de QA",
    phone: "55555555555",
  };'''
)

old = '''async function approveAccessRequest(
  page: import("@playwright/test").Page,
  requestId: string,
) {
  const response = await page.request.post(`/api/admin/access-requests/${requestId}/accept`, {
    data: {
      comment: "Aprovado pelo teste automatizado.",
    },
  });'''

new = '''async function approveAccessRequest(
  page: import("@playwright/test").Page,
  requestId: string,
  createdRequest: {
    email: string;
    fullName: string;
    title: string;
    description: string;
    role: string;
    phone: string;
  },
  profile: (typeof profiles)[number],
) {
  const prepareResponse = await page.request.patch(`/api/admin/access-requests/${requestId}`, {
    data: {
      email: createdRequest.email,
      name: createdRequest.fullName,
      full_name: createdRequest.fullName,
      user: createdRequest.email,
      phone: createdRequest.phone,
      role: createdRequest.role,
      company: profile.needsCompany ? "Testing Company E2E" : undefined,
      client_id: profile.needsCompany ? "cmp_e2e_testing_company" : undefined,
      access_type: profile.value,
      title: createdRequest.title,
      description: createdRequest.description,
      password: PASSWORD,
    },
  });

  const prepareText = await prepareResponse.text();
  expect(prepareResponse.ok(), prepareText).toBeTruthy();

  const response = await page.request.post(`/api/admin/access-requests/${requestId}/accept`, {
    data: {
      comment: "Aprovado pelo teste automatizado.",
    },
  });'''

if old not in content:
    raise SystemExit("Não achei a função approveAccessRequest antiga.")

content = content.replace(old, new, 1)

content = content.replace(
'''      const username = await approveAccessRequest(page, createdRequest.requestId);''',
'''      const username = await approveAccessRequest(page, createdRequest.requestId, createdRequest, profile);'''
)

path.write_text(content, encoding="utf-8")
