import { redirect } from "next/navigation";

export default function DashboardLegacyRedirect() {
  redirect("/admin/visao-geral");
}
