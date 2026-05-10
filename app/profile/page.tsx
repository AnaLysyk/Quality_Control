import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  redirect("/settings/profile");
}
