import { cookies } from "next/headers";
import { getUserById, type UserRecord } from "@/data/usersStore";

export type SessionUser = UserRecord;

export async function getSessionUser(): Promise<SessionUser> {
  const store = await cookies();
  const auth = store.get("auth")?.value;
  const adminUser = process.env.ADMIN_USER || "admin";

  if (auth && auth === adminUser) {
    const admin = getUserById("usr_admin");
    if (admin) return admin;
  }

  return getUserById("usr_001") as SessionUser;
}
