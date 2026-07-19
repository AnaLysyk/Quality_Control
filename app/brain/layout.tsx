import type { ReactNode } from "react";
import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";
import { BrainAccessRequestFlowPanel } from "./_components/BrainAccessRequestFlowPanel";
import "./brain-universe-dark.css";
import styles from "./brain-theme.module.css";

export default async function BrainLayout({ children }: { children: ReactNode }) {
  await requireScreenAccess("brain", "view", { loginNext: "/brain" });

  return (
    <div className={`${styles.brainTheme} space-y-5`}>
      <BrainAccessRequestFlowPanel />
      {children}
    </div>
  );
}
