import { MODULES } from './modules';

type PermMap = Record<string, string[]>;

export const ROLE_DEFAULTS: Record<string, PermMap> = {
  admin: {
    users: ['view', 'create', 'edit', 'delete'],
    tickets: ['view', 'create', 'edit', 'delete', 'assign'],
    defects: ['view', 'create', 'edit', 'delete', 'export'],
    runs: ['view', 'create', 'edit', 'delete'],
    releases: ['view', 'create', 'edit', 'delete'],
    applications: ['view', 'create', 'edit', 'delete'],
    dashboard: ['view'],
  },
  company: {
    users: ['view', 'edit'],
    tickets: ['view', 'create', 'edit', 'assign'],
    defects: ['view', 'create', 'edit', 'export'],
    runs: ['view', 'create'],
    releases: ['view', 'create'],
    applications: ['view'],
    dashboard: ['view'],
  },
  user: {
    tickets: ['view', 'create'],
    defects: ['view'],
    runs: ['view'],
    releases: ['view'],
    applications: ['view'],
    dashboard: ['view'],
  },
  dev: {
    tickets: ['view', 'edit', 'delete', 'assign'],
    defects: ['view', 'edit', 'delete'],
    runs: ['view', 'edit'],
    releases: ['view', 'edit'],
    applications: ['view'],
    dashboard: ['view'],
  },
};

export const ALL_MODULE_KEYS = MODULES.map((m) => m.key);

export default ROLE_DEFAULTS;
