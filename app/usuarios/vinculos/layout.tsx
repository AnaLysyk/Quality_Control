import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

type UsuariosVinculosLayoutProps = Readonly<{ children: ReactNode }>;

export default async function UsuariosVinculosLayout({ children }: UsuariosVinculosLayoutProps) {
  await requireScreenAccess("relationships", "view", { loginNext: "/usuarios/vinculos" });
  return <>{children}</>;
}
