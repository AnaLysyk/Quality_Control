"use client";

import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./LanguageSelector.module.css";

interface LanguageSelectorProps {
  variant?: "icon" | "text" | "full";
  className?: string;
}

export function LanguageSelector({ variant = "icon", className = "" }: LanguageSelectorProps) {
  const { locale, toggleLocale, setLocale } = useLanguage();

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleLocale}
        className={`${styles.iconButton} ${className}`}
        title={locale === "pt" ? "Switch to English" : "Mudar para Português"}
        aria-label={locale === "pt" ? "Switch to English" : "Mudar para Português"}
      >
        <span className={styles.flagIcon}>
          {locale === "pt" ? "🇧🇷" : "🇺🇸"}
        </span>
        <span className={styles.langCode}>{locale.toUpperCase()}</span>
      </button>
    );
  }

  if (variant === "text") {
    return (
      <button
        type="button"
        onClick={toggleLocale}
        className={`${styles.textButton} ${className}`}
        title={locale === "pt" ? "Switch to English" : "Mudar para Português"}
      >
        {locale === "pt" ? "EN" : "PT"}
      </button>
    );
  }

  // full variant with dropdown
  return (
    <div className={`${styles.selector} ${className}`}>
      <button
        type="button"
        className={`${styles.currentLang} ${locale === "pt" ? styles.active : ""}`}
        onClick={() => setLocale("pt")}
      >
        <span className={styles.flagIcon}>🇧🇷</span>
        <span>PT</span>
      </button>
      <span className={styles.divider}>|</span>
      <button
        type="button"
        className={`${styles.currentLang} ${locale === "en" ? styles.active : ""}`}
        onClick={() => setLocale("en")}
      >
        <span className={styles.flagIcon}>🇺🇸</span>
        <span>EN</span>
      </button>
    </div>
  );
}

export default LanguageSelector;
