import type { NavItemDef, NavModuleDef } from "@/backend/navigation/navigationCatalog";

export type BrainHomeAction = {
  id: string;
  label: string;
  prompt: string;
  description: string;
  href?: string | null;
  moduleLabel?: string | null;
  children?: BrainHomeAction[];
};

function itemToAction(item: NavItemDef, moduleLabel: string): BrainHomeAction {
  return {
    id: item.id,
    label: item.label,
    prompt: `Contexto: ${moduleLabel} > ${item.label}`,
    description: item.group ?? item.routeId ?? "ação disponível",
    href: item.href ?? null,
    moduleLabel,
    children: item.children?.map((child) => itemToAction(child, moduleLabel)) ?? [],
  };
}

export function buildBrainHomeActions(modules: NavModuleDef[]): BrainHomeAction[] {
  return modules
    .filter((module) => module.id !== "home" && (module.href || module.items.length > 0))
    .map((module) => {
      const children = module.items.map((item) => itemToAction(item, module.label));
      return {
        id: module.id,
        label: module.label,
        prompt: `Contexto: ${module.label}`,
        description: children.length ? children.slice(0, 2).map((item) => item.label).join(" • ") : "abrir contexto",
        href: module.href ?? null,
        moduleLabel: module.label,
        children,
      };
    });
}
