const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "local-auth-store.json");
const samplePath = path.join(dataDir, "local-auth-store.sample.json");

const company = {
  id: "cmp_e2e_testing_company",
  name: "Testing Company E2E",
  company_name: "Testing Company E2E",
  slug: "testing-company-e2e",
  status: "active",
  active: true,
  tax_id: "12096933000103",
  address: "AVENIDA PEDRO ADAMS FILHO, 5857 - GUARANI - NOVO HAMBURGO/RS",
  phone: "5197282361",
  website: "https://testingcompany.com.br",
  linkedin_url: "https://www.linkedin.com/company/testing-company",
  createdAt: new Date().toISOString()
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

fs.mkdirSync(dataDir, { recursive: true });

const store =
  readJson(storePath) ||
  readJson(samplePath) ||
  { users: [], companies: [], memberships: [], links: [] };

store.users = Array.isArray(store.users) ? store.users : [];
store.companies = Array.isArray(store.companies) ? store.companies : [];
store.memberships = Array.isArray(store.memberships) ? store.memberships : [];
store.links = Array.isArray(store.links) ? store.links : [];

store.companies = store.companies.filter(
  (item) => item.id !== company.id && item.slug !== company.slug
);

store.companies.push(company);

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");

console.log("[E2E][SEED] Empresa criada no JSON local:", company.name);
