// Ambient module declarations for optional runtime fetch packages
declare module "node-fetch" {
  const fetch: unknown;
  export default fetch;
}

declare module "undici" {
  export const fetch: unknown;
  const undici: { fetch?: unknown } & unknown;
  export default undici;
}

// Allow importing these packages without TS errors when they're not installed.
