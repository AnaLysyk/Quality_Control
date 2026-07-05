"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./LanguageSelector.module.css";

interface LanguageSelectorProps {
  variant?: "icon" | "text" | "full";
  className?: string;
}

const LANGUAGE_LABELS = {
  pt: {
    code: "PT",
    country: "BR",
    name: "Português",
    next: "Mudar para inglês",
  },
  en: {
    code: "EN",
    country: "US",
    name: "English",
    next: "Switch to Portuguese",
  },
} as const;

export function LanguageSelector({ variant = "icon", className = "" }: LanguageSelectorProps) {
  const { locale, toggleLocale, setLocale } = useLanguage();
  const current = LANGUAGE_LABELS[locale];
  const nextLocale = locale === "pt" ? "en" : "pt";
  const next = LANGUAGE_LABELS[nextLocale];

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleLocale}
        className={`${styles.iconButton} ${className}`}
        title={current.next}
        aria-label={current.next}
      >
        <span className={styles.countryBadge} aria-hidden="true">
          {current.country}
        </span>
        <span className={styles.langCode}>{next.code}</span>
      </button>
    );
  }

  if (variant === "text") {
    return (
      <button
        type="button"
        onClick={toggleLocale}
        className={`${styles.textButton} ${className}`}
        title={current.next}
        aria-label={current.next}
      >
        {next.code}
      </button>
    );
  }

  return (
    <div className={`${styles.selector} ${className}`} role="group" aria-label="Selecionar idioma / Select language">
      <button
        type="button"
        className={`${styles.currentLang} ${locale === "pt" ? styles.active : ""}`}
        onClick={() => setLocale("pt")}
        aria-pressed={locale === "pt"}
        title="Português"
      >
        <span className={styles.countryBadge} aria-hidden="true">BR</span>
        <span>PT</span>
      </button>
      <span className={styles.divider} aria-hidden="true">|</span>
      <button
        type="button"
        className={`${styles.currentLang} ${locale === "en" ? styles.active : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        title="English"
      >
        <span className={styles.countryBadge} aria-hidden="true">US</span>
        <span>EN</span>
      </button>
    </div>
  );
}

export default LanguageSelector;
