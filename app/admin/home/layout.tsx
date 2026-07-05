import type { ReactNode } from "react";
import styles from "./home-theme.module.css";

export default function AdminHomeLayout({ children }: { children: ReactNode }) {
  return <div className={styles.homeTheme}>{children}</div>;
}
