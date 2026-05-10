import { runBrainDailyMaintenance } from "@/lib/brain/maintenanceService";

async function main() {
  const companySlug = process.argv.find((item) => item.startsWith("--company="))?.split("=")[1] ?? null;
  const result = await runBrainDailyMaintenance({ companySlug });
  // eslint-disable-next-line no-console
  console.log("[brain-maintenance] result", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[brain-maintenance] failed", error);
  process.exit(1);
});
