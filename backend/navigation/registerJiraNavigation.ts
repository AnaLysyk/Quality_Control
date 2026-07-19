import { NAV_CATALOG, type NavItemDef } from "./navigationCatalog";

const jiraItem: NavItemDef = {
  id: "quality-jira",
  routeId: "",
  label: "Jira",
  iconKey: "trello",
  module: "quality",
  companyRoute: "jira",
  requiredPermission: { moduleId: "jira", action: "view" },
  favoriteEnabled: true,
  testId: "nav-quality-jira",
};

const qualityModule = NAV_CATALOG.find((module) => module.id === "quality");
const defectsItem = qualityModule?.items.find((item) => item.id === "quality-defects");

if (defectsItem) {
  const children = defectsItem.children ?? [];
  if (!children.some((item) => item.id === jiraItem.id)) {
    defectsItem.children = [...children, jiraItem];
  }
}
