import type { Capability } from "./permissions.types";

export function hasCapability(capabilities: Capability[] | null | undefined, capability: Capability): boolean {
  if (!capabilities || capabilities.length === 0) return false;
  if (capabilities.includes("*")) return true;
  return capabilities.includes(capability);
}
