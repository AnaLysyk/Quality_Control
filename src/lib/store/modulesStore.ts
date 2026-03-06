import { setJson, getJson } from '../store/redisClient';

const MODULES_KEY = 'qc:modules_catalog';

export const DEFAULT_MODULES = [
  { id: 'dashboard', label: 'Dashboard', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { id: 'applications', label: 'Aplicações', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { id: 'releases', label: 'Releases', actions: ['view', 'create', 'edit'] },
  { id: 'runs', label: 'Runs', actions: ['view', 'create', 'edit'] },
  { id: 'defects', label: 'Defeitos', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'tickets', label: 'Chamados', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'users', label: 'Usuários', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'notes', label: 'Notas', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'notifications', label: 'Notificações', actions: ['view', 'create'] },
  { id: 'audit', label: 'Auditoria', actions: ['view', 'export'] },
  { id: 'settings', label: 'Configurações', actions: ['view', 'edit'] },
];

export async function getModulesCatalog() {
  const v = await getJson(MODULES_KEY);
  if (v) return v;
  await setJson(MODULES_KEY, DEFAULT_MODULES);
  return DEFAULT_MODULES;
}

export async function seedModulesIfMissing() {
  const v = await getJson(MODULES_KEY);
  if (!v) await setJson(MODULES_KEY, DEFAULT_MODULES);
}
