import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeContent from "./home/HomeContent";

export default async function Page() {
  const cookieStore = await cookies();
  const authToken =
    cookieStore.get("auth_token")?.value ??
    cookieStore.get("sb-access-token")?.value ??
    cookieStore.get("access_token")?.value ??
    null;

  if (!authToken) {
    redirect("/login");
  }

  return <HomeContent />;
}
