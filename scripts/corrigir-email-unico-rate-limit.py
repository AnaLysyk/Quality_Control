from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

content = content.replace(
'''const REAL_EMAIL = "ana.testing.company@gmail.com";
const PASSWORD = "TESTE123456";''',
'''const REAL_EMAIL = "ana.testing.company@gmail.com";
const PASSWORD = "TESTE123456";

function buildUniqueEmail(profileValue: string, unique: number) {
  const [user, domain] = REAL_EMAIL.split("@");
  return `${user}+${profileValue}.${unique}@${domain}`;
}'''
)

content = content.replace(
'''      const unique = Date.now();

      await openRequestForm(page);''',
'''      const unique = Date.now();
      const requestEmail = buildUniqueEmail(profile.value, unique);

      await openRequestForm(page);'''
)

content = content.replace(
'''        await supportLogin.fill(REAL_EMAIL);''',
'''        await supportLogin.fill(requestEmail);'''
)

content = content.replace(
'''      await page.getByTestId("request-access-email-input").fill(REAL_EMAIL);''',
'''      await page.getByTestId("request-access-email-input").fill(requestEmail);'''
)

content = content.replace(
'''      expect(submitResponse.ok(), responseText).toBeTruthy();''',
'''      expect(submitResponse.status(), responseText).toBe(201);'''
)

content = content.replace(
'''          requesterEmail?: string;''',
'''          requesterEmail?: string;'''
)

content = content.replace(
'''      expect(responseJson.item?.id).toBeTruthy();
      expect(responseJson.item?.requestType).toBe(profile.value);''',
'''      expect(responseJson.item?.id).toBeTruthy();
      expect(responseJson.item?.requestType).toBe(profile.value);
      expect(responseJson.item?.requesterEmail).toBe(requestEmail);'''
)

path.write_text(content, encoding="utf-8")
