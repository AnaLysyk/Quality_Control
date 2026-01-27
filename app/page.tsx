
import HomeContent from "./home/HomeContent";
import { redirect } from "next/navigation";

async function hasSession() {
  try {
    const { cookies }: typeof import("next/headers") = await import("next/headers");
    const store = await cookies();
    return Boolean(store.get("session_id")?.value);
  } catch {
    return false;
  }
}

export default async function Page() {
  const session = await hasSession();
  if (!session) {
    redirect("/login");
  }

  return <HomeContent />;
}
