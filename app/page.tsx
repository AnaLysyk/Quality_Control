import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeContent from "./home/HomeContent";

export default function Page() {
  const authToken =
    cookies().get("auth_token")?.value ??
    cookies().get("sb-access-token")?.value ??
    cookies().get("access_token")?.value ??
    null;

  if (!authToken) {
    redirect("/login");
  }

  return <HomeContent />;
}
