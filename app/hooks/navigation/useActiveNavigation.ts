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
  const pathMatches = current.path === target.path || current.path.startsWith(`${target.path}/`);
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

function itemIsActive(item: NavItemDef, currentPath: string): boolean {
  return hrefMatches(currentPath, item.href);
}

function moduleIsActive(mod: NavModuleDef, currentPath: string): boolean {
  if (hrefMatches(currentPath, mod.href)) return true;
  return mod.items.some((item) => itemIsActive(item, currentPath));
}

export function useActiveNavigation(modules: NavModuleDef[], currentPath: string) {
  const activeModuleId = useMemo<string | null>(() => {
    for (const mod of modules) {
      if (moduleIsActive(mod, currentPath)) return mod.id;
    }
    return null;
  }, [modules, currentPath]);

  const isModuleActive = useMemo(
    () =>
      (mod: NavModuleDef): boolean =>
        moduleIsActive(mod, currentPath),
    [currentPath],
  );

  const isItemActive = useMemo(
    () =>
      (item: NavItemDef): boolean =>
        itemIsActive(item, currentPath),
    [currentPath],
  );

  return { activeModuleId, isModuleActive, isItemActive };
}

