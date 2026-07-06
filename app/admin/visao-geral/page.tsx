import VisaoGeralPageClient from "./VisaoGeralCompacta";
import styles from "./VisaoGeralTheme.module.css";

export default function VisaoGeralPage() {
  return (
    <div className={styles.themeScope}>
      <VisaoGeralPageClient />
    </div>
  );
}
