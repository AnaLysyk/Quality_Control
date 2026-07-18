import { runBrainDailyMaintenance } from "@/backend/brain/maintenanceService";

async function main() {
  const companySlug = process.argv.find((item) => item.startsWith("--company="))?.split("=")[1] ?? null;
  const result = await runBrainDailyMaintenance({ companySlug });
  console.log("[brain-maintenance] result", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[brain-maintenance] failed", error);
  process.exit(1);
});

