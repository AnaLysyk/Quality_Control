import { RunDetailKanbanPanel } from "@/empresas/[slug]/runs/RunDetailKanbanPanel";
import type { RunDetailViewModel } from "@/lib/runDetailViewModel";

export function RunKanbanSection({ vm }: { vm: RunDetailViewModel }) {
  const companySlug = vm.companySlug !== "demo" ? vm.companySlug : undefined;

  return (
    <section>
      <RunDetailKanbanPanel
        run={{
          slug: vm.releaseData.slug,
          sourceType: vm.source === "MANUAL" ? "manual" : "integrated",
          applicationLabel: vm.appMeta.label,
          projectCode: vm.projectCode,
          runId: vm.runId,
          stats: {
            ...vm.stats,
            total: vm.total,
          },
          raw: vm.releaseData as Record<string, unknown>,
        }}
        companySlug={companySlug}
      />
    </section>
  );
}
