import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

type PlanosDeTesteLayoutProps = Readonly<{ children: ReactNode }>;

export default async function PlanosDeTesteLayout({ children }: PlanosDeTesteLayoutProps) {
  await requireScreenAccess("test_plan", "read", { loginNext: "/planos-de-teste" });
  return <>{children}</>;
}
