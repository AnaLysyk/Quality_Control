import { redirect } from "next/navigation";

export default function AdminProfileRedirectPage() {
  redirect("/admin/permissions");
}
