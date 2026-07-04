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

function isBrowserEvent(value: unknown): value is Event {
  return typeof Event !== "undefined" && value instanceof Event;
}

function describeBrowserEvent(event: Event) {
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase() ?? "unknown";
  const source =
    target instanceof HTMLScriptElement
      ? target.src
      : target instanceof HTMLLinkElement
        ? target.href
        : target instanceof HTMLImageElement
          ? target.src
          : "";

  return `${event.type || "event"}:${tagName}${source ? `:${source}` : ""}`;
}

export function ClientBootScripts({
  migrateStorageScript,
  themeInitScript,
}: ClientBootScriptsProps) {
  useEffect(() => {
    runInlineScript(migrateStorageScript);
    runInlineScript(themeInitScript);
  }, [migrateStorageScript, themeInitScript]);

  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (!isBrowserEvent(event.reason)) return;

      console.warn(
        "[runtime] Rejeição de recurso/HMR ignorada para evitar erro [object Event]",
        describeBrowserEvent(event.reason),
      );
      event.preventDefault();
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  return null;
}
