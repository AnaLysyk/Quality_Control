import styles from "./permissions-clean-layout.module.css";

export default function PermissionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={styles.permissionsCleanLayout}>{children}</div>;
}
