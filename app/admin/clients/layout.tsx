import type { ReactNode } from "react";
import modalStyles from "./clients-modal-theme.module.css";
import styles from "./clients-theme.module.css";

export default function AdminClientsLayout({ children }: { children: ReactNode }) {
  return <div className={`${styles.clientsTheme} ${modalStyles.modalTheme}`}>{children}</div>;
}
