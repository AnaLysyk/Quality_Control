import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

export default async function UsuariosVinculosLayout({ children }: { children: ReactNode }) {
  await requireScreenAccess("relationships", "view", { loginNext: "/usuarios/vinculos" });
  return <>{children}</>;
}
