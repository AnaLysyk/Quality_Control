"use client";

import { useEffect } from "react";
import "@/backend/navigation/registerJiraNavigation";

type ClientBootScriptsProps = {
  migrateStorageScript: string;
  themeInitScript: string;
};

function runInlineScript(source: string) {
  if (!source) return;

  try {
    // `source` is always one of the fixed script literals authored in app/layout.tsx
    // (themeInitScript/migrateStorageScript), never derived from user/request input.
    new Function(source)(); // NOSONAR: no dynamic/untrusted input reaches this call
  } catch (error) {
    console.warn("[boot-script] Falha ao executar script inicial", error);
  }
}

function removePermissionsNativeSearchSuggestions() {
  if (typeof document === "undefined") return;

  const searchInput = document.querySelector<HTMLInputElement>(
    'input[list="permissions-search-suggestions"]',
  );
  searchInput?.removeAttribute("list");
  searchInput?.setAttribute("autocomplete", "off");

  const datalist = document.getElementById("permissions-search-suggestions");
  datalist?.remove();
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
    removePermissionsNativeSearchSuggestions();
  }, [migrateStorageScript, themeInitScript]);

  useEffect(() => {
    removePermissionsNativeSearchSuggestions();

    const observer = new MutationObserver(() => {
      removePermissionsNativeSearchSuggestions();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

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
