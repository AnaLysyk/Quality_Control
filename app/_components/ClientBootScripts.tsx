"use client";

import { useEffect } from "react";

type ClientBootScriptsProps = {
  migrateStorageScript: string;
  themeInitScript: string;
};

function runInlineScript(source: string) {
  if (!source) return;

  try {
    new Function(source)();
  } catch (error) {
    console.warn("[boot-script] Falha ao executar script inicial", error);
  }
}

export function ClientBootScripts({
  migrateStorageScript,
  themeInitScript,
}: ClientBootScriptsProps) {
  useEffect(() => {
    runInlineScript(migrateStorageScript);
    runInlineScript(themeInitScript);
  }, [migrateStorageScript, themeInitScript]);

  return null;
}
