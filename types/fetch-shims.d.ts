// Ambient module declarations for optional runtime fetch packages
declare module "node-fetch" {
  const fetch: any;
  export default fetch;
}

declare module "undici" {
  export const fetch: any;
  const undici: { fetch?: any } & any;
  export default undici;
}

// Allow importing these packages without TS errors when they're not installed.
