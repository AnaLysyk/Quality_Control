import type { ReactNode } from "react";
import styles from "./permissions-theme.module.css";

export default function UsersPermissionsLayout({ children }: { children: ReactNode }) {
  return <div className={styles.permissionsTheme}>{children}</div>;
}
