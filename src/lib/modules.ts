export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'applications', label: 'Aplicações', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'releases', label: 'Releases', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'runs', label: 'Runs', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'defects', label: 'Defeitos', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'tickets', label: 'Chamados', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
  { key: 'users', label: 'Usuários', actions: ['view', 'create', 'edit', 'delete'] },
] as const;

export type ModuleDef = (typeof MODULES)[number];

export default MODULES;
