import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

export default async function CasosDeTesteLayout({ children }: { children: ReactNode }) {
  await requireScreenAccess("test_repository", "read", { loginNext: "/casos-de-teste" });
  return <>{children}</>;
}
