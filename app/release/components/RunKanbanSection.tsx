import { RunDetailKanbanSection } from "@/components/RunDetailKanbanSection";
import { RunKanbanStream } from "../RunKanbanStream";
import type { RunDetailViewModel } from "@/lib/runDetailViewModel";
import type { ReleaseEntry } from "../data";

export function RunKanbanSection({ vm }: { vm: RunDetailViewModel }) {
  const companySlug = vm.companySlug !== "demo" ? vm.companySlug : undefined;

  return (
    <section>
      {vm.source === "API" ? (
        <RunKanbanStream
          projectKey={vm.projectKey}
          projectCode={vm.projectCode}
          runId={(vm.releaseData as ReleaseEntry).runId ?? 0}
          companySlug={companySlug}
          persistEndpoint={vm.apiPersistEndpoint}
          editable={false}
          allowStatusChange={false}
          allowLinkEdit={vm.canPersistApiLinks}
        />
      ) : (
        <RunDetailKanbanSection
          data={{ pass: [], fail: [], blocked: [], notRun: [] }}
          project={vm.projectKey}
          runId={0}
          qaseProject={vm.projectCode}
          companySlug={companySlug}
          persistEndpoint={`/api/releases-manual/${vm.releaseData.slug}/cases`}
          editable={true}
          allowStatusChange={true}
          allowLinkEdit={false}
        />
      )}
    </section>
  );
}
