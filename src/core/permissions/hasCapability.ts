/**
 * Utility to check if a user has a given capability.
 * Supports wildcard ('*') for full access.
 */
import type { Capability } from "./permissions.types";

/**
 * Checks if a capability array contains a specific capability or wildcard.
 * @param capabilities - List of user capabilities
 * @param capability - Capability to check
 * @returns true if allowed, false otherwise
 */
export function hasCapability(capabilities: Capability[] | null | undefined, capability: Capability): boolean {
  if (!capabilities || capabilities.length === 0) return false;
  if (capabilities.includes("*")) return true;
  return capabilities.includes(capability);
}
