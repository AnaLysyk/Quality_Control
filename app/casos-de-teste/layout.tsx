import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

type CasosDeTesteLayoutProps = Readonly<{ children: ReactNode }>;

export default async function CasosDeTesteLayout({ children }: CasosDeTesteLayoutProps) {
  await requireScreenAccess("test_repository", "read", { loginNext: "/casos-de-teste" });
  return <>{children}</>;
}
