import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

export default async function ChatLayout({ children }: { children: ReactNode }) {
  await requireScreenAccess("chat", "view", { loginNext: "/chat" });
  return <>{children}</>;
}
