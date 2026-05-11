"use client";

import { useMemo } from "react";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";

function hrefMatches(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  const baseHref = href.split("?")[0]?.split("#")[0] ?? href;
  if (baseHref === "/") return pathname === "/";
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function itemIsActive(item: NavItemDef, pathname: string): boolean {
  return hrefMatches(pathname, item.href);
}

function moduleIsActive(mod: NavModuleDef, pathname: string): boolean {
  if (hrefMatches(pathname, mod.href)) return true;
  return mod.items.some((item) => itemIsActive(item, pathname));
}

export function useActiveNavigation(modules: NavModuleDef[], pathname: string) {
  const activeModuleId = useMemo<string | null>(() => {
    for (const mod of modules) {
      if (moduleIsActive(mod, pathname)) return mod.id;
    }
    return null;
  }, [modules, pathname]);

  const isModuleActive = useMemo(
    () =>
      (mod: NavModuleDef): boolean =>
        moduleIsActive(mod, pathname),
    [pathname],
  );

  const isItemActive = useMemo(
    () =>
      (item: NavItemDef): boolean =>
        itemIsActive(item, pathname),
    [pathname],
  );

  return { activeModuleId, isModuleActive, isItemActive };
}
