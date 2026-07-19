import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

export default async function PlanosDeTesteLayout({ children }: { children: ReactNode }) {
  await requireScreenAccess("test_plan", "read", { loginNext: "/planos-de-teste" });
  return <>{children}</>;
}
