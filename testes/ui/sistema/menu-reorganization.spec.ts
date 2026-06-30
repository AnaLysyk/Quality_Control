import { expect, test } from "../../../support/fixtures/test";
import { simularAutenticacao, type OpcoesAutenticacaoSimulada } from "../../../support/functions/ui/apoio/simular-autenticacao";

type MenuProfileCase = {
  title: string;
  auth: OpcoesAutenticacaoSimulada;
  visible: string[];
  hidden: string[];
};

const profileCases: MenuProfileCase[] = [
  {
    title: "leader_tc visualiza menus administrativos sem operações",
    auth: {
      role: "leader_tc",
      permissionRole: "leader_tc",
      companyRole: "leader_tc",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
      isGlobalAdmin: true,
    },
    visible: [
      "nav-home",
      "nav-companies",
      "nav-test-repository",
      "nav-automation",
      "nav-requests",
      "nav-support",
      "nav-chat",
      "nav-brain",
      "nav-documents",
      "nav-users",
      "nav-admin",
    ],
    hidden: ["nav-operations"],
  },
  {
    title: "technical_support visualiza menus de suporte sem operações e ações internas de líder",
    auth: {
      role: "technical_support",
      permissionRole: "technical_support",
      companyRole: "technical_support",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
    },
    visible: [
      "nav-home",
      "nav-companies",
      "nav-test-repository",
      "nav-automation",
      "nav-requests",
      "nav-support",
      "nav-chat",
      "nav-brain",
      "nav-documents",
      "nav-users",
      "nav-admin",
    ],
    hidden: [
      "nav-operations",
      "nav-users-create-leader-tc",
      "nav-users-create-support",
      "nav-users-create-user-tc",
    ],
  },
  {
    title: "testing_company_user não visualiza operações, usuários, admin e solicitações",
    auth: {
      role: "testing_company_user",
      permissionRole: "testing_company_user",
      companyRole: "testing_company_user",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
    },
    visible: [
      "nav-home",
      "nav-companies",
      "nav-test-repository",
      "nav-automation",
      "nav-support",
      "nav-chat",
      "nav-brain",
      "nav-documents",
    ],
    hidden: [
      "nav-operations",
      "nav-requests",
      "nav-users",
      "nav-admin",
      "nav-operations-search",
    ],
  },
  {
    title: "empresa visualiza apenas módulos de cliente",
    auth: {
      role: "empresa",
      permissionRole: "empresa",
      companyRole: "empresa",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
    },
    visible: [
      "nav-home",
      "nav-test-repository",
      "nav-support",
      "nav-brain",
      "nav-documents",
    ],
    hidden: [
      "nav-companies",
      "nav-operations",
      "nav-automation",
      "nav-requests",
      "nav-chat",
      "nav-users",
      "nav-admin",
    ],
  },
  {
    title: "company_user visualiza apenas menus permitidos para usuário de empresa",
    auth: {
      role: "company_user",
      permissionRole: "company_user",
      companyRole: "company_user",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
    },
    visible: [
      "nav-home",
      "nav-support",
      "nav-brain",
      "nav-documents",
    ],
    hidden: [
      "nav-companies",
      "nav-operations",
      "nav-test-repository",
      "nav-automation",
      "nav-requests",
      "nav-chat",
      "nav-users",
      "nav-admin",
    ],
  },
];

test.describe("Menu lateral por perfil", () => {
  for (const profileCase of profileCases) {
    test(profileCase.title, async ({ context, page }) => {
      await simularAutenticacao(context, profileCase.auth);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/home", { waitUntil: "domcontentloaded" });

      for (const testId of profileCase.visible) {
        await expect(page.getByTestId(testId), `${testId} deveria aparecer`).toBeVisible({
          timeout: 15_000,
        });
      }

      for (const testId of profileCase.hidden) {
        await expect(page.getByTestId(testId), `${testId} não deveria aparecer`).toHaveCount(0);
      }
    });
  }
});
