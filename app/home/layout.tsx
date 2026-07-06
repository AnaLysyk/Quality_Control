import type { ReactNode } from "react";
import "../admin/home/home-route.css";
import styles from "../admin/home/home-theme.module.css";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <div className={`${styles.homeTheme} home-route-theme`}>{children}</div>;
}
