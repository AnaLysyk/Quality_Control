import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";

type ChatLayoutProps = Readonly<{ children: ReactNode }>;

export default async function ChatLayout({ children }: ChatLayoutProps) {
  await requireScreenAccess("chat", "view", { loginNext: "/chat" });
  return <>{children}</>;
}
