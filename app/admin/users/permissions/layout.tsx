import styles from "./permissions-theme.module.css";

export default function UsersPermissionsLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.permissionsTheme}>{children}</div>;
}
