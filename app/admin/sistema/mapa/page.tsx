import { SYSTEM_MODULES } from "@/backend/navigation/module-map";
import { SYSTEM_ROUTES } from "@/backend/navigation/route-map";
import { getUnmappedSystemPageFiles } from "@/backend/navigation/systemPageAudit";
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
