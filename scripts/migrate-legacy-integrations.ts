import dotenv from "dotenv";
import { IntegrationType } from "@prisma/client";
import { prisma } from "../lib/prismaClient";

dotenv.config();

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-n");

  console.log(`Starting legacy integrations migration${dryRun ? " (dry-run)" : ""}...`);

  const companies = await prisma.company.findMany();
  let created = 0;
  let skipped = 0;

  for (const c of companies) {
    const legacyQaseToken = typeof c.qase_token === "string" && c.qase_token.trim() ? c.qase_token.trim() : null;
    const legacyQaseProjects = typeof c.qase_project_code === "string" && c.qase_project_code.trim() ? c.qase_project_code.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const legacyJiraToken = typeof c.jira_api_token === "string" && c.jira_api_token.trim() ? c.jira_api_token.trim() : null;
    const legacyJiraBase = typeof c.jira_base_url === "string" && c.jira_base_url.trim() ? c.jira_base_url.trim() : null;
    const legacyJiraEmail = typeof c.jira_email === "string" && c.jira_email.trim() ? c.jira_email.trim() : null;

    // Qase
    if (legacyQaseToken || legacyQaseProjects.length > 0) {
      const exists = await prisma.companyIntegration.findFirst({ where: { companyId: c.id, type: IntegrationType.QASE } });
      if (exists) {
        skipped++;
      } else {
        const cfg: Record<string, unknown> = {};
        if (legacyQaseToken) cfg.token = legacyQaseToken;
        if (legacyQaseProjects.length) cfg.projects = legacyQaseProjects;
        console.log(`Will create QASE integration for company=${c.slug} id=${c.id} cfg=${JSON.stringify(cfg)}`);
        if (!dryRun) {
          await prisma.companyIntegration.create({ data: { companyId: c.id, type: IntegrationType.QASE, config: cfg as any } });
        }
        created++;
      }
    }

    // Jira
    if (legacyJiraToken || legacyJiraBase || legacyJiraEmail) {
      const exists = await prisma.companyIntegration.findFirst({ where: { companyId: c.id, type: IntegrationType.JIRA } });
      if (exists) {
        skipped++;
      } else {
        const cfg: Record<string, unknown> = {};
        if (legacyJiraBase) cfg.baseUrl = legacyJiraBase;
        if (legacyJiraEmail) cfg.email = legacyJiraEmail;
        if (legacyJiraToken) cfg.token = legacyJiraToken;
        console.log(`Will create JIRA integration for company=${c.slug} id=${c.id} cfg=${JSON.stringify(cfg)}`);
        if (!dryRun) {
          await prisma.companyIntegration.create({ data: { companyId: c.id, type: IntegrationType.JIRA, config: cfg as any } });
        }
        created++;
      }
    }
  }

  console.log(`Done. created=${created} skipped=${skipped} (note: skipped counts existing integrations).`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
