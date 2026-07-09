"use client";

import { useMemo } from "react";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";

const NAV_QUERY_KEYS = ["tab", "modal", "role"] as const;

function splitPath(value: string) {
  const [pathWithQuery] = value.split("#");
  const [path = "", query = ""] = pathWithQuery.split("?");
  return { path: path || "/", query: new URLSearchParams(query) };
}

function hrefMatches(currentPath: string, href: string | undefined): boolean {
  if (!href) return false;

  const current = splitPath(currentPath);
  const target = splitPath(href);

  if (target.path === "/") return current.path === "/";

  const pathMatches =
    current.path === target.path ||
    current.path.startsWith(target.path + "/");

  if (!pathMatches) return false;
  if (!href.includes("?")) return true;

  const targetHasNavQuery = NAV_QUERY_KEYS.some((key) => target.query.has(key));
  if (!targetHasNavQuery) return true;

  for (const key of NAV_QUERY_KEYS) {
    const expected = target.query.get(key);
    const actual = current.query.get(key);

    if (expected !== null && actual !== expected) return false;
    if (expected === null && actual !== null) return false;
  }

  return true;
}

function getMatchScore(currentPath: string, href: string | undefined): number {
  if (!hrefMatches(currentPath, href)) return 0;

  const target = splitPath(href ?? "");
  let score = target.path.length;

  // query espec?fica vale mais que rota gen?rica
  if ((href ?? "").includes("?")) score += 1000;

  return score;
}

function collectItems(items: NavItemDef[]): NavItemDef[] {
  return items.flatMap((item) => [item, ...collectItems(item.children ?? [])]);
}

export function useActiveNavigation(modules: NavModuleDef[], currentPath: string) {
  const activeItemIds = useMemo(() => {
    const matches: Array<{ id: string; score: number }> = [];

    for (const mod of modules) {
      for (const item of collectItems(mod.items)) {
        const score = getMatchScore(currentPath, item.href);
        if (score > 0) matches.push({ id: item.id, score });
      }
    }

    const bestScore = Math.max(0, ...matches.map((match) => match.score));

    return new Set(
      matches
        .filter((match) => match.score === bestScore)
        .map((match) => match.id),
    );
  }, [modules, currentPath]);

  const isItemActive = useMemo(
    () =>
      (item: NavItemDef): boolean =>
        activeItemIds.has(item.id),
    [activeItemIds],
  );

  const isModuleActive = useMemo(
    () =>
      (mod: NavModuleDef): boolean => {
        if (getMatchScore(currentPath, mod.href) > 0) return true;

        return collectItems(mod.items).some((item) => activeItemIds.has(item.id));
      },
    [activeItemIds, currentPath],
  );

  const activeModuleId = useMemo<string | null>(() => {
    for (const mod of modules) {
      if (isModuleActive(mod)) return mod.id;
    }

    return null;
  }, [isModuleActive, modules]);

  return { activeModuleId, isModuleActive, isItemActive };
}
