import fs from "node:fs";
import path from "node:path";

import { SYSTEM_ROUTES } from "./route-map";
import type { SystemRouteDefinition } from "./navigation.types";

const APP_ROOT = path.join(process.cwd(), "app");

export const SYSTEM_PAGE_MAP_EXCLUSIONS = new Set([
  "app/500/page.tsx",
  "app/login/access-request/page.tsx",
  "app/login/access-request/status/page.tsx",
  "app/login/forgot-password/page.tsx",
  "app/login/page.tsx",
  "app/login/reset-password/page.tsx",
  "app/page.tsx",

  // As duas entradas abrem o mesmo workspace de Gestão de Vínculos. Elas não
  // recebem permissões de tela independentes para evitar dois toggles capazes
  // de divergir. A autoridade única é o módulo `relationships`: o menu exige
  // relationships:view, /admin/users/vinculos é validado no AdminLayout e as
  // APIs de vínculos aplicam relationships:view/create/edit/delete no servidor.
  "app/admin/users/vinculos/page.tsx",
  "app/usuarios/vinculos/page.tsx",
]);

function collectPageFiles(dir: string, output: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for