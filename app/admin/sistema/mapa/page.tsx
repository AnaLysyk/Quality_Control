import { SYSTEM_MODULES } from "@/lib/navigation/module-map";
import { SYSTEM_ROUTES } from "@/lib/navigation/route-map";
import { getUnmappedSystemPageFiles } from "@/lib/navigation/systemPageAudit";
import SistemaMapaClient from "./SistemaMapaClient";

export default function SistemaMapaPage() {
  return (
    <SistemaMapaClient
      modules={SYSTEM_MODULES}
      routes={SYSTEM_ROUTES}
      unmappedPages={getUnmappedSystemPageFiles(SYSTEM_ROUTES)}
    />
  );
}
