import { prisma } from "@/lib/prismaClient";

/**
 * Checks if a user exists in the database by email or id.
 * Returns the user object if found, otherwise null.
 */
export async function findUserByEmailOrId(identifier: string) {
  // Try to find by email first, then by id
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { id: identifier },
      ],
    },
  });
  return user;
}
