import VisaoGeralPageClient from "./VisaoGeralCompacta";
import styles from "./visao-geral-theme.module.css";

export default function VisaoGeralPage() {
  return (
    <main className={styles.overviewTheme}>
      <VisaoGeralPageClient />
    </main>
  );
}
