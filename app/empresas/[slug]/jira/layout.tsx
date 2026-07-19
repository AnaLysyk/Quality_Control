import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

export default async function JiraLayout({ children }: { children: React.ReactNode }) {
  await requireScreenAccess("jira", "view");
  return children;
}
