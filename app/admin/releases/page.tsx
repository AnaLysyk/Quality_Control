
// Rota antiga /admin/releases descontinuada → redireciona para /admin/runs
import { redirect } from "next/navigation";

export default function AdminReleasesRedirect() {
  redirect("/admin/runs");
}
