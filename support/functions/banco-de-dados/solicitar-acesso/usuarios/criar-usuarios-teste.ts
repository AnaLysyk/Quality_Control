import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { hashPasswordSha256 } from "../../../../../backend/passwordHash";

const dataDir = process.env.LOCAL_AUTH_DATA_DIR?.trim();
const password = process.env.E2E_PROFILE_PASSWORD;

if (!dataDir || !password) {
  throw new Error("LOCAL_AUTH_DATA_DIR e E2E_PROFILE_PASSWORD sao obrigatorios para a massa E2E.");
}

const passwordHash = hashPasswordSha256(password);

const companies = [
  {
    id: "cmp_e2e_testing_company",
    name: "Testing Company E2E",
    slug: "testing-company",
    status: "active",
    active: true,
  },
  {
    id: "cmp_e2e_client",
    name: "Empresa Cliente E2E",
    slug: "empresa-e2e",
    status: "active",
    active: true,
  },
];

const users = [
  {
    id: "usr_e2e_leader_tc",
    full_name: "E2E Lider TC",
    name: "E2E Lider TC",
    email: "e2e-leader-tc@testingcompany.local",
    user: "e2e.leader.tc",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "leader_tc",
    globalRole: null,
    is_global_admin: false,
    user_origin: "testing_company",
    user_scope: "shared",
    allow_multi_company_link: true,
  },
  {
    id: "usr_e2e_technical_support",
    full_name: "E2E Suporte Tecnico",
    name: "E2E Suporte Tecnico",
    email: "e2e-suporte@testingcompany.local",
    user: "e2e.suporte",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "technical_support",
    globalRole: null,
    is_global_admin: false,
    user_origin: "testing_company",
    user_scope: "shared",
    allow_multi_company_link: true,
  },
  {
    id: "usr_e2e_testing_company_user",
    full_name: "E2E Usuario Testing Company",
    name: "E2E Usuario Testing Company",
    email: "e2e-user-tc@testingcompany.local",
    user: "e2e.usuario.tc",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "testing_company_user",
    default_company_slug: "testing-company",
    home_company_id: "cmp_e2e_testing_company",
    user_origin: "testing_company",
  },
  {
    id: "usr_e2e_relational_user",
    full_name: "E2E Usuario Relacional",
    name: "E2E Usuario Relacional",
    email: "e2e-relational-user@testingcompany.local",
    user: "e2e.usuario.relacional",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "testing_company_user",
    default_company_slug: "testing-company",
    home_company_id: "cmp_e2e_testing_company",
    user_origin: "testing_company",
    user_scope: "shared",
    allow_multi_company_link: true,
  },
  {
    id: "usr_e2e_qa_quality_user",
    full_name: "E2E QA Quality Control",
    name: "E2E QA Quality Control",
    email: "e2e-qa-quality@testingcompany.local",
    user: "e2e.qa.quality",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "testing_company_user",
    default_company_slug: "testing-company",
    home_company_id: "cmp_e2e_testing_company",
    user_origin: "testing_company",
  },
  {
    id: "usr_e2e_company_user",
    full_name: "E2E Usuario Empresa",
    name: "E2E Usuario Empresa",
    email: "e2e-company-user@empresa.local",
    user: "e2e.usuario.empresa",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "company_user",
    default_company_slug: "empresa-e2e",
    home_company_id: "cmp_e2e_client",
    user_origin: "client_company",
    user_scope: "company_only",
    allow_multi_company_link: false,
  },
  {
    id: "usr_e2e_empresa",
    full_name: "E2E Empresa",
    name: "E2E Empresa",
    email: "e2e-empresa@empresa.local",
    user: "e2e.empresa",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "empresa",
    default_company_slug: "empresa-e2e",
    home_company_id: "cmp_e2e_client",
    user_origin: "client_company",
    user_scope: "company_only",
    allow_multi_company_link: false,
  },
  {
    id: "usr_e2e_password_reset",
    full_name: "E2E Redefinicao de Senha",
    name: "E2E Redefinicao de Senha",
    email: "e2e-password-reset@testingcompany.local",
    user: "e2e.password.reset",
    password_hash: passwordHash,
    active: true,
    status: "active",
    role: "testing_company_user",
    default_company_slug: "testing-company",
    home_company_id: "cmp_e2e_testing_company",
    user_origin: "testing_company",
  },
];

const memberships = [
  {
    id: "mem_e2e_testing_company_user",
    userId: "usr_e2e_testing_company_user",
    companyId: "cmp_e2e_testing_company",
    role: "testing_company_user",
  },
  {
    id: "mem_e2e_relational_testing_company",
    userId: "usr_e2e_relational_user",
    companyId: "cmp_e2e_testing_company",
    role: "testing_company_user",
  },
  {
    id: "mem_e2e_relational_client",
    userId: "usr_e2e_relational_user",
    companyId: "cmp_e2e_client",
    role: "testing_company_user",
  },
  {
    id: "mem_e2e_company_user",
    userId: "usr_e2e_company_user",
    companyId: "cmp_e2e_client",
    role: "company_user",
  },
  {
    id: "mem_e2e_qa_quality_user",
    userId: "usr_e2e_qa_quality_user",
    companyId: "cmp_e2e_testing_company",
    role: "testing_company_user",
  },
  {
    id: "mem_e2e_empresa",
    userId: "usr_e2e_empresa",
    companyId: "cmp_e2e_client",
    role: "empresa",
  },
  {
    id: "mem_e2e_password_reset",
    userId: "usr_e2e_password_reset",
    companyId: "cmp_e2e_testing_company",
    role: "testing_company_user",
  },
];

mkdirSync(dataDir, { recursive: true });
writeFileSync(
  resolve(dataDir, "local-auth-store.json"),
  JSON.stringify({ users, companies, memberships, links: [] }, null, 2),
  "utf8",
);

console.log(`[e2e] Massa de perfis criada em ${dataDir} (${users.length} usuarios).`);
