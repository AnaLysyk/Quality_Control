import { prisma } from "../../lib/prismaClient";

async function run() {
  console.log("Starting backfill: company integrations");
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { qase_token: { not: null } },
        { qase_project_code: { not: null } },
        { jira_base_url: { not: null } },
        { jira_api_token: { not: null } },
      ],
    },
  });

  console.log(`Found ${companies.length} companies with legacy integration fields`);
  let created = 0;
  for (const c of companies) {
    const integrationsToCreate: Array<{ type: string; config: Record<string, unknown> }> = [];
    try {
      if (c.qase_token || c.qase_project_code) {
        const projects: string[] = [];
        if (c.qase_project_code) projects.push(String(c.qase_project_code));
        integrationsToCreate.push({ type: "QASE", config: { token: c.qase_token ?? null, projectCodes: projects } });
      }
      if (c.jira_base_url || c.jira_api_token) {
        integrationsToCreate.push({ type: "JIRA", config: { baseUrl: c.jira_base_url ?? null, email: c.jira_email ?? null, apiToken: c.jira_api_token ?? null } });
      }

      for (const it of integrationsToCreate) {
        await prisma.companyIntegration.create({ data: { companyId: c.id, type: it.type as any, config: it.config as any } });
        created++;
      }
    } catch (err) {
      console.error(`Failed to backfill company ${c.id} (${c.slug}):`, err);
    }
  }

  console.log(`Backfill complete. Created ${created} integration records.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
