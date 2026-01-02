import { getAllReleases } from "@/release/data";
import { getRunDetails } from "@/services/qase";
import DashboardClient from "./DashboardClient";
import { getAppMeta } from "@/lib/appMeta";

type Stats = { pass: number; fail: number; blocked: number; notRun: number };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const releases = await getAllReleases();

  const enriched = await Promise.all(
    releases.map(async (rel) => {
      const projectKey = rel.project ?? rel.app ?? "smart";
      const projectCode = rel.qaseProject ?? (projectKey === "smart" ? "SFQ" : projectKey.toUpperCase());
      const appMeta = getAppMeta(projectKey, projectCode);
      let stats: Stats = { pass: 0, fail: 0, blocked: 0, notRun: 0 };

      try {
        const run = await getRunDetails(projectCode, rel.runId);
        stats = run?.statsNormalized ?? stats;
      } catch (error) {
        console.error(`Erro ao buscar stats da run ${rel.runId}:`, error);
      }

      const total = stats.pass + stats.fail + stats.blocked + stats.notRun;
      const percent = total > 0 ? Math.round((stats.pass / total) * 100) : 0;
      const dateValue = rel.createdAt ? new Date(rel.createdAt).getTime() : 0;

      return {
        app: projectKey,
        appLabel: appMeta.label,
        appColor: appMeta.color,
        slug: rel.slug,
        title: rel.title,
        createdAt: rel.createdAt,
        createdAtValue: dateValue,
        stats,
        percent,
        appMeta,
      };
    })
  );

  const grouped = enriched.reduce((acc: Record<string, typeof enriched>, item) => {
    if (!acc[item.app]) acc[item.app] = [];
    acc[item.app].push(item);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([app, items]) => {
    const sorted = [...items].sort((a, b) => b.createdAtValue - a.createdAtValue);
    const meta = getAppMeta(app);
    return {
      app,
      appLabel: meta.label,
      appColor: meta.color,
      releases: sorted,
    };
  });

  return <DashboardClient sections={sections} />;
}
