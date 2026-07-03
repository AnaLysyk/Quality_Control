export const dynamic = "force-dynamic";

import HomeContent from "./home/HomeContent";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getAccessContext } from "@/lib/auth/session";

export default async function Page() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  const req = new Request(`http://${host}/`, {
    headers: {
      cookie: cookieHeader,
    },
  });

  const access = await getAccessContext(req);
  if (!access) redirect("/login");

  return <HomeContent />;
}
