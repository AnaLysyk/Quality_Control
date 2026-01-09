"use client";

import { useCallback } from "react";
import { useAppSettings } from "@/context/AppSettingsContext";
import { translate, type TranslateFn } from "@/lib/i18n";

export function useI18n() {
  const { language } = useAppSettings();
  const t: TranslateFn = useCallback(
    (key, params) => translate(language, key, params),
    [language]
  );

  return { t, language };
}
