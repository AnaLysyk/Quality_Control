import type { ReactNode } from "react";
import "./home-route.css";
import styles from "./home-theme.module.css";

export default function AdminHomeLayout({ children }: { children: ReactNode }) {
  return <div className={`${styles.homeTheme} home-route-theme`}>{children}</div>;
}
