import type { ReactNode } from "react";
import styles from "./clients-theme.module.css";

export default function AdminClientsLayout({ children }: { children: ReactNode }) {
  return <div className={styles.clientsTheme}>{children}</div>;
}
