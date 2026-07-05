import type { ReactNode } from "react";
import styles from "./access-requests-theme.module.css";

export default function AdminAccessRequestsLayout({ children }: { children: ReactNode }) {
  return <div className={styles.accessRequestsTheme}>{children}</div>;
}
