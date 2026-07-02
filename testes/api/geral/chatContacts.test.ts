jest.mock("server-only", () => ({}));

jest.mock("../../../lib/auth/localStore", () => ({
  listLocalCompanies: jest.fn(),
}));

jest.mock("../../../lib/adminUsers", () => ({
  listAdminUserItems: jest.fn(),
}));

import { listAdminUserItems } from "@/lib/adminUsers";
import { listLocalCompanies } from "@/lib/auth/localStore";
import { listChatContacts } from "@/lib/chatContacts";

describe("chatContacts", () => {
  const companies = [
    { id: "company-alpha-id", name: "Alpha", slug: "alpha" },
    { id: "company-beta-id", name: "Beta", slug: "beta" },
    { id: "company-gamma-id", name: "Gamma", slug: "gamma" },
  ];

  const items = [
    {
      id: "u-self",
      name: "Ana Paula Lysyk",
      email: "ana.paula.lysyk@example.com",
      user: "ana.paula.lysyk",
      avatar_url: null,
      permission_role: "company_user",
      profile_kind: "company_user",
      company_name: "Alpha",
      company_names: ["Alpha"],
      companyIds: ["company-alpha-id"],
      company_ids: ["company-alpha-id"],
      active: true,
      status: "active",
      job_title: "Analista",
      linkedin_url: null,
      origin_label: "Usuário",
    },
    {
      id: "u-beta",
      name: "Beatriz Beta",
      email: "beatriz.beta@example.com",
      user: "beatriz.beta",
      avatar_url: null,
      permission_role: "company_user",
      profile_kind: "company_user",
      company_name: "Beta",
      company_names: ["Beta"],
      companyIds: ["company-beta-id"],
      company_ids: ["company-beta-id"],
      active: true,
      status: "active",
      job_title: "QA",
      linkedin_url: null,
      origin_label: "Usuário",
    },
    {
      id: "u-gamma",
      name: "Gabriela Gamma",
      email: "gabriela.gamma@example.com",
      user: "gabriela.gamma",
      avatar_url: null,
      permission_role: "company_user",
      profile_kind: "company_user",
      company_name: "Gamma",
      company_names: ["Gamma"],
      companyIds: ["company-gamma-id"],
      company_ids: ["company-gamma-id"],
      active: true,
      status: "active",
      job_title: "Produto",
      linkedin_url: null,
      origin_label: "Usuário",
    },
    {
      id: "u-multi",
      name: "Maria Multi",
      email: "maria.multi@example.com",
      user: "maria.multi",
      avatar_url: null,
      permission_role: "company_user",
      profile_kind: "company_user",
      company_name: "Alpha +1",
      company_names: ["Alpha", "Beta"],
      companyIds: ["company-alpha-id", "company-beta-id"],
      company_ids: ["company-alpha-id", "company-beta-id"],
      active: true,
      status: "active",
      job_title: "Operações",
      linkedin_url: null,
      origin_label: "Usuário",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (listLocalCompanies as jest.Mock).mockResolvedValue(companies);
    (listAdminUserItems as jest.Mock).mockResolvedValue(items);
  });

  test("non privileged users see contacts from linked companies only", async () => {
    const visible = await listChatContacts(
      {
        userId: "u-self",
        companyId: "company-alpha-id",
        companySlug: "alpha",
        companySlugs: ["alpha", "beta"],
        isGlobalAdmin: false,
        role: "company_user",
        companyRole: "company_user",
      },
      "",
    );

    expect(visible.map((item) => item.id)).toEqual(["u-beta", "u-multi"]);
    expect(visible.every((item) => item.id !== "u-self")).toBe(true);
  });

  test("search spans name, email and company metadata", async () => {
    const visible = await listChatContacts(
      {
        userId: "u-self",
        companyId: "company-alpha-id",
        companySlug: "alpha",
        companySlugs: ["alpha", "beta"],
        isGlobalAdmin: false,
        role: "company_user",
        companyRole: "company_user",
      },
      "maria multi",
    );

    expect(visible.map((item) => item.id)).toEqual(["u-multi"]);
  });

  test("privileged users can see every contact except themselves", async () => {
    const visible = await listChatContacts(
      {
        userId: "u-self",
        companyId: null,
        companySlug: null,
        companySlugs: [],
        isGlobalAdmin: false,
        role: "technical_support",
        companyRole: "technical_support",
      },
      "",
    );

    expect(visible.map((item) => item.id)).toEqual(["u-beta", "u-gamma", "u-multi"]);
  });

  test("global admin via globalRole can see every contact except themselves", async () => {
    const visible = await listChatContacts(
      {
        userId: "u-self",
        companyId: null,
        companySlug: null,
        companySlugs: [],
        isGlobalAdmin: false,
        role: null,
        companyRole: null,
        globalRole: "global_admin",
      },
      "",
    );

    expect(visible.map((item) => item.id)).toEqual(["u-beta", "u-gamma", "u-multi"]);
  });
});

