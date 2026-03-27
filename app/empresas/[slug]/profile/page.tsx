import { redirect } from "next/navigation";

export default function CompanyProfileRedirect() {
  redirect("/settings/profile");
}
