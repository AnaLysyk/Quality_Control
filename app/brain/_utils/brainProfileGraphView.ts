import { NAV_CATALOG } from "@/lib/navigation/navigationCatalog";
import type { BrainContextCompany, BrainContextProject, BrainEdge, BrainNode, BrainNodeStatus } from "../_types/brain.types";

export type BrainViewerMode = "leadership" | "tc_user" | "company_user" | "company" | "unknown";

export type BrainProfileGraphOptions = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  selectedNode: BrainNode | null;
  selectedProfileType: string | null;
  activeModule: string | null;
  companies: BrainContextCompany[];
  projects: BrainContextProject[];
  selectedCompanyId: string | null;
  selectedProjectId: string | null;
  canSeeAllCompanies: boolean;
  hasActiveFilter: boolean;
  viewerMode?: BrainViewerMode;
  viewerEmail?: string | null;
};

type CatalogItem = {
  id: string;
  routeId?: string;
  label: string;
  module?: string;
  href?: string;
  allowedRoles?: string[];
  onlyRoles?: string[];
  requiredPermission?: { moduleId: string; action: string };
  children?: CatalogItem[];
};

type CatalogModule = CatalogItem & {
  items?: CatalogItem[];
};

const COMPANY_COLORS = ["#67e8f9", "#a78bfa", "#34d399", "#facc15", "#fb7185", "#60a5fa", "#f472b6", "#2dd4bf"];
const CORE_ID = "quality-control-core";
const PROFILE_FLOW = ["Líder TC", "Suporte técnico", "Usuário Test Company", "Usuário empresarial", "Empresas"];
const USER_TYPE_FLOW = ["Líder TC", "Suporte técnico", "Usuário Test Company", "Usuário empresarial"];
const PENDING_STATUSES = ["pending", "missing", "warning", "error", "orphan"];
const MENU_MODULE_ORDER = NAV_CATALOG.map((item) => item.label);

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}:${normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sem-contexto"}`;
}

function profileLabel(value: unknown) {
  const normalized = normalize(value);
  if (["leader", "leader-tc", "leader_tc", "lider", "lider-tc", "lider tc", "lider_tc"].some((item) => normalized.includes(item))) return "Líder TC";
  if (["technical-support", "technical_support", "suporte", "suporte tecnico", "support"].some((item) => normalized.includes(item))) return "Suporte técnico";
  if (["testing_company_user", "testing-company-user", "usuario tc", "user tc", "tc user", "analista tc", "qa tc", "test company"].some((item) => normalized.includes(item))) return "Usuário Test Company";
  if (["company-user", "company_user", "usuario empresarial", "usuario empresa", "user company", "empresa usuario"].some((item) => normalized.includes(item))) return "Usuário empresarial";
  if (["empresa", "company", "empresas"].some((item) => normalized === item || normalized.includes(item))) return "Empresas";
  if (!normalized || normalized === "perfil nao informado" || normalized === "nao informado") return "Usuário empresarial";
  return String(value ?? "Usuário empresarial").trim();
}

function systemRolesForProfile(profile: string | null) {
  const label = profileLabel(profile);
  if (label === "Líder TC") return ["leader_tc"];
  if (label === "Suporte técnico") return ["technical_support"];
  if (label === "Usuário Test Company") return ["testing_company_user"];
  if (label === "Usuário empresarial") return ["company_user"];
  if (label === "Empresas") return ["empresa", "company_user"];
  return ["company_user"];
}

function userTypeLabel(value: unknown) {
  const label = profileLabel(value);
  return label === "Empresas" ? "Usuário empresarial" : label;
}

function isLeadershipProfile(profile: string | null) {
  const value = normalize(profile);
  return value === "lider tc" || value === "suporte tecnico";
}

function isCompanyManagementProfile(profile: string | null) {
  const value = normalize(profile);
  return value === "empresas" || value === "usuario empresarial";
}

function isTcUserType(value: unknown) {
  return normalize(value) === normalize("Usuário Test Company");
}

export function profileTypeForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const candidates = [metadata.profileType, metadata.accessType, metadata.permissionRole, metadata.companyRole, metadata.role, metadata.requestedRole, node.type === "profile" ? node.label : null];
  const found = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return profileLabel(found);
}

function userTypeForNode(node: BrainNode | null | undefined) {
  const metadata = node?.metadata ?? {};
  const candidates = [metadata.userType, metadata.profileType, metadata.accessType, metadata.permissionRole, metadata.companyRole, metadata.role, metadata.requestedRole, node?.type === "profile" ? node.label : null];
  const found = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return userTypeLabel(found);
}

function companyKeyForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const key = node.companyId ?? String(metadata.companyId ?? metadata.companySlug ?? metadata.company ?? node.companyName ?? "").trim();
  return key || null;
}

function companyNameForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const name = node.companyName ?? String(metadata.companyName ?? metadata.company ?? metadata.companySlug ?? "").trim();
  return name || null;
}

function colorForCompany(companyKey: string | null) {
  if (!companyKey) return COMPANY_COLORS[0];
  const value = Array.from(companyKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COMPANY_COLORS[value % COMPANY_COLORS.length];
}

function withCompanyColor(node: BrainNode): BrainNode {
  const companyKey = companyKeyForNode(node);
  return { ...node, metadata: { ...node.metadata, companyColor: colorForCompany(companyKey), companyKey, userType: userTypeForNode(node) } };
}

function profileMatches(node: BrainNode, profile: string | null) {
  if (!profile) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isScopeHub || node.metadata?.isPermissionNode) return true;
  return normalize(profileTypeForNode(node)) === normalize(profile) || !node.metadata?.accessType;
}

function companyMatches(node: BrainNode, companyId: string | null) {
  if (!companyId) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isScopeHub || node.metadata?.isPermissionNode) return true;
  if (node.companyId) return node.companyId === companyId;
  const key = companyKeyForNode(node);
  return !key || key === companyId;
}

function projectMatches(node: BrainNode, projectId: string | null) {
  if (!projectId) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub || node.metadata?.isScopeHub || node.metadata?.isPermissionNode) return true;
  return !node.projectId || node.projectId === projectId;
}

function moduleMatches(node: BrainNode, module: string | null) {
  if (!module) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub || node.metadata?.isScopeHub || node.metadata?.isPermissionNode) return true;
  return node.module === module || moduleLabel(node.module) === module || moduleLabel(node.module) === moduleLabel(module);
}

function creatorKey(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const key = node.createdByEmail ?? node.createdBy ?? String(metadata.userEmail ?? metadata.requesterEmail ?? metadata.email ?? metadata.createdBy ?? metadata.actorEmail ?? "").trim();
  return key || null;
}

function creatorMatchesViewer(node: BrainNode, viewerEmail: string | null | undefined) {
  if (!viewerEmail) return true;
  const key = creatorKey(node);
  return Boolean(key && normalize(key) === normalize(viewerEmail));
}

function userLabel(node: BrainNode) {
  const metadata = node.metadata ?? {};
  return String(metadata.userName ?? metadata.actorName ?? metadata.name ?? node.createdByEmail ?? node.createdBy ?? metadata.email ?? node.label ?? "Usuário do contexto").trim();
}

function statusFor(nodes: BrainNode[]): BrainNodeStatus {
  if (!nodes.length) return "ok";
  return nodes.some((node) => PENDING_STATUSES.includes(node.status)) ? "pending" : "ok";
}

function pendingCount(nodes: BrainNode[]) {
  return nodes.filter((node) => PENDING_STATUSES.includes(node.status)).length;
}

function moduleLabel(module: string) {
  const normalized = normalize(module);
  const catalog = NAV_CATALOG.find((item) => normalize(item.id) === normalized || normalize(item.label) === normalized);
  if (catalog) return catalog.label;
  const aliases: Record<string, string> = {
    quality: "Controle de qualidade",
    support: "Suporte",
    documents: "Documentos",
    automation: "Automação",
    requests: "Solicitações",
    companies: "Gestão de Empresas",
    users: "Usuários",
    management: "Gestão",
    agenda: "Agenda",
    brain: "Brain",
    chat: "Chat",
    permissoes: "Permissões",
    permissions: "Permissões",
  };
  return aliases[normalized] ?? module;
}

function moduleOrder(label: string) {
  const index = MENU_MODULE_ORDER.findIndex((item) => normalize(item) === normalize(label));
  return index === -1 ? 999 : index;
}

function rolesAllow(allowedRoles: unknown, profile: string | null) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  const roleSet = new Set(systemRolesForProfile(profile).map(normalize));
  return allowedRoles.map(normalize).some((role) => roleSet.has(role));
}

function catalogItemAllowed(item: CatalogItem | CatalogModule, profile: string | null) {
  if (Array.isArray(item.onlyRoles) && item.onlyRoles.length > 0 && !rolesAllow(item.onlyRoles, profile)) return false;
  return rolesAllow(item.allowedRoles, profile);
}

function flattenCatalogItems(module: CatalogModule, profile: string | null) {
  const rows: Array<{ module: CatalogModule; item: CatalogItem }> = [];
  const visit = (item: CatalogItem) => {
    if (catalogItemAllowed(item, profile)) rows.push({ module, item });
    item.children?.forEach(visit);
  };
  module.items?.forEach(visit);
  return rows;
}

function catalogModulesForProfile(profile: string | null) {
  return (NAV_CATALOG as CatalogModule[])
    .filter((module) => catalogItemAllowed(module, profile))
    .map((module) => ({
      id: module.id,
      label: module.label,
      href: module.href,
      requiredPermission: module.requiredPermission,
      items: flattenCatalogItems(module, profile),
    }));
}

function catalogScreensForModule(profile: string | null, moduleName: string | null) {
  if (!moduleName) return [];
  const normalizedModule = normalize(moduleLabel(moduleName));
  return catalogModulesForProfile(profile)
    .filter((module) => normalize(module.label) === normalizedModule || normalize(module.id) === normalize(moduleName))
    .flatMap((module) => {
      const moduleSelf = module.href
        ? [{ module, item: { id: `${module.id}-root`, routeId: module.id, label: module.label, module: module.id, href: module.href, requiredPermission: module.requiredPermission } as CatalogItem }]
        : [];
      return [...moduleSelf, ...module.items];
    });
}

function permissionScreenNode(profile: string, row: ReturnType<typeof catalogScreensForModule>[number], layerLabel: string): BrainNode {
  const required = row.item.requiredPermission;
  const label = row.item.label;
  const module = moduleLabel(row.module.label);
  return {
    id: stableId(`permission:${profile}:${row.module.id}`, row.item.routeId ?? row.item.id ?? label),
    type: "permission",
    module,
    label,
    description: `Tela liberada para ${profile} pela Gestão de Permissões.`,
    status: "ok",
    size: "md",
    information: required
      ? `${label} depende da permissão ${required.moduleId}:${required.action}.`
      : `${label} é liberada pelo perfil ${profile}.`,
    requiredPermissions: required ? [`${required.moduleId}:${required.action}`] : [],
    visibleByPermission: true,
    source: { type: "navigation", route: row.item.href },
    metadata: {
      isPermissionNode: true,
      isDetailNode: true,
      profileType: profile,
      layer: 5,
      layerLabel,
      routeId: row.item.routeId,
      route: row.item.href,
      requiredPermission: required ? `${required.moduleId}:${required.action}` : "perfil",
    },
  };
}

function qualityControlCore(nodes: BrainNode[]): BrainNode {
  return {
    id: CORE_ID,
    type: "module",
    module: "Núcleo",
    label: "Quality Control",
    description: "Núcleo principal do Brain. A leitura segue Gestão de Permissões: perfil, usuários, empresas, módulos liberados e telas permitidas.",
    status: statusFor(nodes),
    size: "lg",
    information: `Núcleo principal com ${nodes.length} nó(s). O Brain mostra o sistema conforme perfis, módulos e permissões liberadas em Gestão de Permissões.`,
    metadata: { isBrainCore: true, isContextCore: true, layer: 0, layerLabel: "0. Núcleo", count: nodes.length, pendingCount: pendingCount(nodes), profileFlow: PROFILE_FLOW },
  };
}

function profileRoot(profile: string, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => normalize(profileTypeForNode(node)) === normalize(profile) || node.metadata?.isPermissionNode);
  const catalogModules = catalogModulesForProfile(profile);
  return {
    id: stableId("profile", profile),
    type: "profile",
    module: "1. Perfil",
    label: profile,
    description: "Perfil controlado pela Gestão de Permissões. Clique/filtre para ver módulos, usuários e telas liberadas.",
    status: statusFor(scoped),
    size: "lg",
    information: `${profile} possui ${catalogModules.length} módulo(s) liberado(s) no catálogo de permissões e ${scoped.length} nó(s) no contexto atual.`,
    metadata: { isProfileRoot: true, profileType: profile, layer: 1, layerLabel: "1. Perfil", count: catalogModules.length, pendingCount: pendingCount(scoped), permissionModules: catalogModules.map((item) => item.label) },
  };
}

function scopeHub(profile: string, scopeType: "companies" | "users" | "requests" | "agenda" | "modules", nodes: BrainNode[], viewerMode: BrainViewerMode, selectedCompanyId: string | null): BrainNode {
  const isTcUser = viewerMode === "tc_user";
  const isCompanyUser = viewerMode === "company_user";
  const labels = {
    companies: isTcUser ? "Empresas vinculadas" : isCompanyUser ? "Minha empresa" : "Empresas",
    users: "Usuários por perfil",
    modules: "Módulos liberados",
    requests: "Solicitações Quality Control",
    agenda: "Agenda operacional",
  };
  const descriptions = {
    companies: isTcUser ? "Selecione a empresa vinculada para ver o que o usuário Test Company criou nela." : isCompanyUser ? "Visão geral da própria empresa, sem precisar escolher outra empresa." : "Visão geral das empresas. Ao clicar, mostra módulos e tudo que foi criado naquela empresa.",
    users: "Usuários ficam separados por tipo e precisam respeitar o perfil/permissão efetiva.",
    modules: "Módulos e telas que este perfil pode ver conforme Gestão de Permissões.",
    requests: "Solicitações que podem virar empresa ou usuários.",
    agenda: "Agenda por empresa, usuário, módulo e contexto.",
  };
  const catalogCount = scopeType === "modules" ? catalogModulesForProfile(profile).length : 0;
  const scoped = scopeType === "requests" ? nodes.filter((node) => node.type === "access_request") : scopeType === "users" ? nodes.filter((node) => creatorKey(node)) : nodes;
  const guidance = isTcUser && scopeType === "companies" && !selectedCompanyId ? " Primeiro selecione a empresa." : "";
  return {
    id: stableId(`scope:${profile}`, scopeType),
    type: "module",
    module: scopeType === "modules" ? "Gestão de Permissões" : "1. Gestão",
    label: labels[scopeType],
    description: `${descriptions[scopeType]}${guidance}`,
    status: statusFor(scoped),
    size: "lg",
    information: `${descriptions[scopeType]}${guidance}`,
    metadata: { isScopeHub: true, scopeType, profileType: profile, layer: 1, layerLabel: scopeType === "modules" ? "2. Permissões" : "1. Gestão", count: scopeType === "modules" ? catalogCount : scoped.length, pendingCount: pendingCount(scoped), requiresCompanySelection: isTcUser && scopeType === "companies" },
  };
}

function userTypeHub(type: string, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => normalize(userTypeForNode(node)) === normalize(type));
  return { id: stableId("user-type", type), type: "profile", module: "2. Tipo de usuário", label: type, description: isTcUserType(type) ? "Clique para listar os usuários Test Company. Depois escolha o usuário e a empresa vinculada para abrir módulos e telas que ele pode ver." : type === "Usuário empresarial" ? "Clique para listar usuários empresariais. Depois escolha o usuário para abrir módulos liberados." : "Clique para listar usuários deste tipo. Depois escolha a pessoa para abrir módulos e itens criados.", status: statusFor(scoped), size: "lg", information: `${type}: ${scoped.length} item(ns) vinculados.`, metadata: { isUserTypeHub: true, userType: type, layer: 2, layerLabel: "2. Tipo de usuário", count: scoped.length, pendingCount: pendingCount(scoped) } };
}

function companyHub(company: BrainContextCompany, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.companyId === company.id || companyKeyForNode(node) === company.id || companyNameForNode(node) === company.name);
  return { id: `company:${company.id}`, type: "company", module: "2. Empresa", label: company.name, description: "Empresa selecionada. A visão geral mostra módulos e itens criados nessa empresa; a visão por usuário mostra só o que aquela pessoa criou.", status: statusFor(scoped), size: "lg", companyId: company.id, companyName: company.name, information: `${company.name} possui ${scoped.length} nó(s) visíveis neste recorte.`, metadata: { isCompanyHub: true, layer: 2, layerLabel: "2. Empresa", companyColor: colorForCompany(company.id), count: scoped.length, pendingCount: pendingCount(scoped) } };
}

function projectHub(project: BrainContextProject, company: BrainContextCompany | null, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.projectId === project.id);
  return { id: `project:${project.id}`, type: "project", module: "3. Projeto", label: project.name, description: "Projeto selecionado dentro da empresa.", status: statusFor(scoped), size: "lg", companyId: company?.id ?? project.companyId ?? undefined, companyName: company?.name, projectId: project.id, projectName: project.name, information: `${project.name} possui ${scoped.length} nó(s).`, metadata: { isProjectHub: true, layer: 3, layerLabel: "3. Projeto", companyColor: colorForCompany(company?.id ?? project.companyId ?? null), count: scoped.length, pendingCount: pendingCount(scoped) } };
}

function moduleHub(module: string, nodes: BrainNode[], company: BrainContextCompany | null, profile: string): BrainNode {
  const label = moduleLabel(module);
  const scoped = nodes.filter((node) => node.module === module || moduleLabel(node.module) === label);
  const permissionScreens = catalogScreensForModule(profile, label);
  return { id: `${company ? `company:${company.id}:` : ""}module:${stableId("", label)}`, type: "module", module: label, label, description: "Módulo permitido pela Gestão de Permissões. Clique para ver as telas liberadas e itens criados neste módulo.", status: statusFor(scoped), size: "lg", companyId: company?.id, companyName: company?.name, information: `${label} possui ${permissionScreens.length} tela(s) liberada(s) para ${profile} e ${scoped.length} item(ns) no contexto.`, metadata: { isModuleHub: true, module, moduleLabel: label, menuModule: true, layer: 4, layerLabel: "4. Módulo permitido", companyColor: colorForCompany(company?.id ?? null), count: permissionScreens.length || scoped.length, pendingCount: pendingCount(scoped), permissionScreens: permissionScreens.map((row) => row.item.label), source: "permission-catalog" } };
}

function userHub(userKey: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const sample = nodes[0];
  const companies = uniqueById(nodes.map((node) => ({ id: companyKeyForNode(node) ?? "sem-empresa", name: companyNameForNode(node) ?? "Sem empresa" })));
  const userType = userTypeForNode(sample);
  return { id: stableId(`user:${company?.id ?? "all"}`, userKey), type: "person", module: "3. Usuário", label: userLabel(sample), description: isTcUserType(userType) ? "Usuário Test Company. Selecione a empresa vinculada para abrir os módulos e telas permitidas naquela empresa." : "Usuário selecionado. Ao abrir, aparecem módulos permitidos e itens criados.", status: statusFor(nodes), size: "md", companyId: company?.id, companyName: company?.name, information: `${userLabel(sample)} possui ${nodes.length} item(ns), atua em ${companies.length} empresa(s) e aparece como ${userType}.`, metadata: { isUserHub: true, layer: 3, layerLabel: "3. Usuário", userKey, userType, userProfiles: [userType], userCompanies: companies, companyColor: colorForCompany(company?.id ?? null), count: nodes.length, pendingCount: pendingCount(nodes) } };
}

export function getBrainProfileTypes(nodes: BrainNode[]) {
  const fromNodes = Array.from(new Set(nodes.map(profileTypeForNode).filter(Boolean)));
  return uniqueById([...PROFILE_FLOW, ...fromNodes].map((label) => ({ id: normalize(label), label }))).map((item) => item.label);
}

function groupNodesByUser(nodes: BrainNode[]) {
  const groups = new Map<string, BrainNode[]>();
  nodes.forEach((node) => { const key = creatorKey(node); if (!key) return; groups.set(key, [...(groups.get(key) ?? []), node]); });
  return groups;
}

function companyNodesForItems(items: BrainNode[], companies: BrainContextCompany[]) {
  const ids = new Set(items.map(companyKeyForNode).filter((value): value is string => Boolean(value)));
  const matched = companies.filter((company) => ids.has(company.id));
  const synthetic = Array.from(ids).filter((id) => !matched.some((company) => company.id === id)).map((id) => ({ id, name: items.find((node) => companyKeyForNode(node) === id)?.companyName ?? id }));
  return [...matched, ...synthetic];
}

export function buildBrainProfileGraphView(options: BrainProfileGraphOptions) {
  const { nodes, edges, selectedNode, selectedProfileType, activeModule, companies, projects, selectedCompanyId, selectedProjectId, canSeeAllCompanies, hasActiveFilter, viewerMode = "unknown", viewerEmail = null } = options;
  const effectiveViewerMode: BrainViewerMode = viewerMode === "unknown" ? (canSeeAllCompanies ? "leadership" : "company_user") : viewerMode;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedProfileFromNode = selectedNode?.metadata?.isProfileRoot ? String(selectedNode.metadata.profileType ?? selectedNode.label) : null;
  const profile = selectedProfileType ?? selectedProfileFromNode;
  const defaultProfile = effectiveViewerMode === "company_user" || effectiveViewerMode === "company" ? "Empresas" : "Líder TC";
  const currentProfile = profile ?? defaultProfile;
  const clickedUserType = selectedNode?.metadata?.isUserTypeHub ? String(selectedNode.metadata.userType ?? selectedNode.label) : null;
  const clickedUserKey = selectedNode?.metadata?.isUserHub ? String(selectedNode.metadata.userKey ?? "") : null;
  const baseNodes = nodes.filter((node) => profileMatches(node, profile)).filter((node) => companyMatches(node, selectedCompanyId)).filter((node) => projectMatches(node, selectedProjectId)).filter((node) => moduleMatches(node, activeModule)).map(withCompanyColor);
  const viewerOwnNodes = effectiveViewerMode === "tc_user" || effectiveViewerMode === "company_user" ? baseNodes.filter((node) => creatorMatchesViewer(node, viewerEmail)) : baseNodes;
  const currentUserItemsAllCompanies = clickedUserKey ? baseNodes.filter((node) => creatorKey(node) === clickedUserKey) : [];
  const currentUserType = clickedUserKey ? userTypeForNode(currentUserItemsAllCompanies[0] ?? selectedNode) : clickedUserType;
  const clickedTcUserNeedsCompany = clickedUserKey && isTcUserType(currentUserType) && !selectedCompanyId;
  const requiresCompanyForItems = (effectiveViewerMode === "tc_user" && !selectedCompanyId) || Boolean(clickedTcUserNeedsCompany);
  const operationalNodes = requiresCompanyForItems ? [] : clickedUserKey ? currentUserItemsAllCompanies.filter((node) => companyMatches(node, selectedCompanyId)) : viewerOwnNodes;
  const viewNodes: BrainNode[] = [];
  const viewEdges: BrainEdge[] = [];
  const coreNode = qualityControlCore(nodes);
  viewNodes.push(coreNode);
  const companiesScope = scopeHub(currentProfile, "companies", baseNodes, effectiveViewerMode, selectedCompanyId);
  const usersScope = scopeHub(currentProfile, "users", baseNodes, effectiveViewerMode, selectedCompanyId);
  const modulesScope = scopeHub(currentProfile, "modules", operationalNodes.length ? operationalNodes : baseNodes, effectiveViewerMode, selectedCompanyId);
  const requestsScope = scopeHub(currentProfile, "requests", baseNodes, effectiveViewerMode, selectedCompanyId);
  const agendaScope = scopeHub(currentProfile, "agenda", operationalNodes.filter((node) => moduleLabel(node.module) === "Agenda" || node.type === "event"), effectiveViewerMode, selectedCompanyId);
  if (!profile && !selectedNode && !activeModule && !hasActiveFilter) {
    const rootScopes = [companiesScope, usersScope, modulesScope];
    viewNodes.push(...rootScopes);
    rootScopes.forEach((scope) => viewEdges.push({ id: `${CORE_ID}-${scope.id}`, source: CORE_ID, target: scope.id, label: String(scope.metadata?.scopeType) === "modules" ? "permissões" : String(scope.metadata?.scopeType), type: String(scope.metadata?.scopeType) === "modules" ? "permission_allows" : "relation", status: scope.status }));
    return { nodes: uniqueById(viewNodes), edges: uniqueById(viewEdges), focusNodeId: CORE_ID, focusModule: "Quality Control" };
  }
  const currentProfileNode = profileRoot(currentProfile, operationalNodes.length ? operationalNodes : baseNodes.length ? baseNodes : nodes);
  const isLeadership = effectiveViewerMode === "leadership" || isLeadershipProfile(currentProfile);
  const isCompanyLike = effectiveViewerMode === "company" || effectiveViewerMode === "company_user" || isCompanyManagementProfile(currentProfile);
  const isIndividualUser = effectiveViewerMode === "tc_user" || effectiveViewerMode === "company_user";
  viewNodes.push(currentProfileNode);
  viewEdges.push({ id: `${CORE_ID}-${currentProfileNode.id}`, source: CORE_ID, target: currentProfileNode.id, label: "perfil", type: "relation", status: currentProfileNode.status });
  const scopeNodes = isLeadership ? [companiesScope, usersScope, modulesScope, requestsScope, agendaScope] : isCompanyLike ? [companiesScope, usersScope, modulesScope] : [companiesScope, usersScope, modulesScope];
  viewNodes.push(...scopeNodes);
  scopeNodes.forEach((scope) => viewEdges.push({ id: `${currentProfileNode.id}-${scope.id}`, source: currentProfileNode.id, target: scope.id, label: String(scope.metadata?.scopeType) === "requests" ? "analisa" : String(scope.metadata?.scopeType) === "modules" ? "permite" : "abre", type: String(scope.metadata?.scopeType) === "modules" ? "permission_allows" : "relation", status: scope.status }));
  const userGroupsSource = clickedUserType ? baseNodes.filter((node) => normalize(userTypeForNode(node)) === normalize(clickedUserType)) : baseNodes;
  const userGroups = groupNodesByUser(userGroupsSource);
  const userTypeNodes = USER_TYPE_FLOW.map((type) => userTypeHub(type, baseNodes));
  viewNodes.push(...userTypeNodes);
  userTypeNodes.forEach((node) => viewEdges.push({ id: `${usersScope.id}-${node.id}`, source: usersScope.id, target: node.id, label: "tipo", type: "relation", status: node.status }));
  const userNodes = Array.from(userGroups.entries()).slice(0, selectedCompany ? 24 : 18).map(([userKey, items]) => userHub(userKey, items, selectedCompany));
  if (clickedUserType || selectedNode?.metadata?.scopeType === "users" || clickedUserKey || isCompanyLike || isLeadership) {
    viewNodes.push(...userNodes);
    userNodes.forEach((user) => { const typeNode = userTypeNodes.find((node) => normalize(node.metadata?.userType) === normalize(user.metadata?.userType)); viewEdges.push({ id: `${typeNode?.id ?? usersScope.id}-${user.id}`, source: typeNode?.id ?? usersScope.id, target: user.id, label: "usuário", type: "created_by", status: user.status, companyId: user.companyId, metadata: { companyColor: user.metadata?.companyColor } }); });
  }
  const companiesForSelectedUser = clickedUserKey ? companyNodesForItems(currentUserItemsAllCompanies, companies) : [];
  const companyOptions = clickedUserKey && isTcUserType(currentUserType) ? (selectedCompany ? [selectedCompany] : companiesForSelectedUser) : selectedCompany ? [selectedCompany] : effectiveViewerMode === "company_user" || effectiveViewerMode === "company" ? companies.slice(0, 1) : companies;
  const companySourceNodes = clickedUserKey ? currentUserItemsAllCompanies : selectedCompanyId || effectiveViewerMode === "company_user" ? operationalNodes : baseNodes;
  const companyHubs = companyOptions.map((company) => companyHub(company, companySourceNodes));
  viewNodes.push(...companyHubs);
  const companyParent = clickedUserKey && isTcUserType(currentUserType) ? userNodes.find((user) => String(user.metadata?.userKey) === clickedUserKey)?.id ?? usersScope.id : companiesScope.id;
  companyHubs.forEach((company) => viewEdges.push({ id: `${companyParent}-${company.id}`, source: companyParent, target: company.id, label: clickedUserKey && isTcUserType(currentUserType) ? "empresa do usuário" : "empresa", type: "belongs_to_company", status: company.status, companyId: company.companyId, metadata: { companyColor: company.metadata?.companyColor } }));
  const selectedCompanyHub = selectedCompany ? companyHubs.find((company) => company.companyId === selectedCompany.id) ?? null : companyHubs[0] ?? null;
  const selectedProjectHub = selectedProject ? projectHub(selectedProject, selectedCompany, operationalNodes) : null;
  if (selectedProjectHub) { viewNodes.push(selectedProjectHub); viewEdges.push({ id: `${selectedCompanyHub?.id ?? companiesScope.id}-${selectedProjectHub.id}`, source: selectedCompanyHub?.id ?? companiesScope.id, target: selectedProjectHub.id, label: "projeto", type: "belongs_to_project", status: selectedProjectHub.status, companyId: selectedCompany?.id, projectId: selectedProjectHub.projectId, metadata: { companyColor: selectedProjectHub.metadata?.companyColor } }); }
  const moduleSourceNodes = clickedUserKey ? operationalNodes : isIndividualUser ? operationalNodes : selectedCompanyId ? baseNodes : baseNodes;
  const permissionModuleNames = catalogModulesForProfile(currentProfile).map((module) => module.label);
  const moduleNames = Array.from(new Set([...moduleSourceNodes.map((node) => moduleLabel(node.module)).filter(Boolean), ...permissionModuleNames])).sort((a, b) => moduleOrder(moduleLabel(a)) - moduleOrder(moduleLabel(b)) || moduleLabel(a).localeCompare(moduleLabel(b), "pt-BR"));
  const moduleHubs = moduleNames.map((module) => moduleHub(module, moduleSourceNodes, selectedCompany, currentProfile));
  const shouldShowModules = !requiresCompanyForItems && Boolean(clickedUserKey || selectedCompany || selectedProject || activeModule || selectedNode?.metadata?.isCompanyHub || selectedNode?.metadata?.isProfileRoot || selectedNode?.metadata?.scopeType === "modules" || hasActiveFilter || effectiveViewerMode === "company_user" || effectiveViewerMode === "company" || isLeadership);
  if (shouldShowModules) {
    viewNodes.push(modulesScope, ...moduleHubs);
    const moduleParent = clickedUserKey ? userNodes.find((user) => String(user.metadata?.userKey) === clickedUserKey)?.id ?? modulesScope.id : selectedProjectHub?.id ?? selectedCompanyHub?.id ?? modulesScope.id;
    if (!clickedUserKey && !selectedProjectHub && !selectedCompanyHub) viewEdges.push({ id: `${currentProfileNode.id}-${modulesScope.id}`, source: currentProfileNode.id, target: modulesScope.id, label: "permissões", type: "permission_allows", status: modulesScope.status });
    moduleHubs.forEach((module) => viewEdges.push({ id: `${moduleParent}-${module.id}`, source: moduleParent, target: module.id, label: "módulo liberado", type: "permission_allows", status: module.status, companyId: selectedCompany?.id, metadata: { companyColor: module.metadata?.companyColor } }));
  }
  const clickedModule = selectedNode?.metadata?.isModuleHub ? String(selectedNode.metadata.module ?? selectedNode.module) : null;
  const moduleFocus = activeModule ?? clickedModule;
  const itemCandidatesByModule = moduleFocus ? moduleSourceNodes.filter((node) => node.module === moduleFocus || moduleLabel(node.module) === moduleFocus || moduleLabel(node.module) === moduleLabel(moduleFocus)) : moduleSourceNodes;
  const showItems = !requiresCompanyForItems && Boolean(moduleFocus || activeModule || hasActiveFilter || selectedNode?.metadata?.isModuleHub);
  const permissionScreens = showItems ? catalogScreensForModule(currentProfile, moduleFocus ?? selectedNode?.module ?? "") : [];
  const permissionNodes = permissionScreens.map((row) => permissionScreenNode(currentProfile, row, "5. Tela liberada"));
  const itemLimit = hasActiveFilter ? 36 : clickedUserKey ? 30 : 24;
  const detailItems = showItems ? uniqueById(itemCandidatesByModule).filter((node) => !node.metadata?.isProfileRoot && !node.metadata?.isCompanyHub && !node.metadata?.isModuleHub && !node.metadata?.isScopeHub && !node.metadata?.isUserTypeHub && !node.metadata?.isUserHub && !node.metadata?.isPermissionNode).slice(0, itemLimit) : [];
  viewNodes.push(...permissionNodes, ...detailItems.map((node) => ({ ...node, metadata: { ...node.metadata, isDetailNode: true, layer: 6, layerLabel: clickedUserKey ? "6. Item criado pelo usuário" : "6. Item" } })));
  const moduleTarget = moduleFocus ? moduleHubs.find((module) => module.metadata?.module === moduleFocus || module.metadata?.moduleLabel === moduleLabel(moduleFocus))?.id ?? selectedProjectHub?.id ?? selectedCompanyHub?.id ?? modulesScope.id : modulesScope.id;
  permissionNodes.forEach((node) => viewEdges.push({ id: `${moduleTarget}-${node.id}`, source: moduleTarget, target: node.id, label: "tela liberada", type: "permission_allows", status: node.status, module: node.module }));
  detailItems.forEach((node) => viewEdges.push({ id: `${moduleTarget}-${node.id}`, source: moduleTarget, target: node.id, label: clickedUserKey ? "criou" : "item", type: "contains", status: node.status, companyId: node.companyId, projectId: node.projectId, module: node.module, metadata: { companyColor: node.metadata?.companyColor } }));
  const accessRequestItems = baseNodes.filter((node) => node.type === "access_request").slice(0, hasActiveFilter ? 24 : 10);
  if (isLeadership && selectedNode?.metadata?.scopeType === "requests") { viewNodes.push(...accessRequestItems.map((node) => ({ ...node, metadata: { ...node.metadata, isDetailNode: true, layer: 4, layerLabel: "4. Solicitação" } }))); accessRequestItems.forEach((node) => viewEdges.push({ id: `${requestsScope.id}-${node.id}`, source: requestsScope.id, target: node.id, label: "solicitação", type: "contains", status: node.status, companyId: node.companyId, projectId: node.projectId, module: node.module, metadata: { companyColor: node.metadata?.companyColor } })); }
  const retainedIds = new Set(viewNodes.map((node) => node.id));
  const retainedEdges = edges.filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target)).map((edge) => ({ ...edge, metadata: { ...edge.metadata, companyColor: colorForCompany(edge.companyId ?? null) } }));
  return { nodes: uniqueById(viewNodes), edges: uniqueById([...viewEdges, ...retainedEdges]), focusNodeId: selectedNode?.id ?? currentProfileNode.id, focusModule: moduleLabel(moduleFocus ?? clickedUserType ?? selectedProfileType ?? "Quality Control") };
}
