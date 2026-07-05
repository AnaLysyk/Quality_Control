import { redirect } from "next/navigation";

export default function AdminDashboardLegacyRedirect() {
  redirect("/admin/visao-geral");
}
