from pathlib import Path

path = Path("tests-e2e/access-requests/access-request-real-email-headed.ui.spec.ts")
content = path.read_text(encoding="utf-8")

old = '''      expect(submitResponse.ok(), responseText).toBeTruthy();

      await expect(page.getByText(/sua solicitação foi recebida/i)).toBeVisible({
        timeout: 60000,
      });'''

new = '''      expect(submitResponse.ok(), responseText).toBeTruthy();

      const responseJson = JSON.parse(responseText) as {
        ok?: boolean;
        item?: {
          id?: string;
          requestType?: string;
          requestedCompanyId?: string;
          requestedCompanySlug?: string;
          requesterEmail?: string;
        };
      };

      expect(responseJson.ok).toBeTruthy();
      expect(responseJson.item?.id).toBeTruthy();
      expect(responseJson.item?.requestType).toBe(profile.value);

      if (profile.needsExistingCompany) {
        expect(responseJson.item?.requestedCompanyId).toBe("cmp_e2e_testing_company");
        expect(responseJson.item?.requestedCompanySlug).toBe("Testing Company E2E");
      }'''

if old not in content:
    raise SystemExit("Não achei o trecho final antigo para substituir.")

content = content.replace(old, new)

path.write_text(content, encoding="utf-8")
