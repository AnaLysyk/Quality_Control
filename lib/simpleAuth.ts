import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";

/**
 * Checks if a user exists in the database by email or id.
 * Returns the user object if found, otherwise null.
 */
export async function findUserByEmailOrId(identifier: string) {
  return findLocalUserByEmailOrId(identifier);
}
