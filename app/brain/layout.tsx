import type { ReactNode } from "react";
import { BrainAccessRequestFlowPanel } from "./_components/BrainAccessRequestFlowPanel";
import styles from "./brain-theme.module.css";

export default function BrainLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.brainTheme} space-y-5`}>
      <BrainAccessRequestFlowPanel />
      {children}
    </div>
  );
}
