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

const COMPANY_COLORS = ["#67e8f9", "#a78bfa", "#34d399", "#facc15", "#fb7185", "#60a5fa", "#f472b6", "#2dd4bf"];
const CORE_ID = "quality-control-core";
const PROFILE_FLOW = ["Líder TC", "Suporte técnico", "Usuário TC", "Usuário empresarial", "Empresas"];
const USER_TYPE_FLOW = ["Líder TC", "Suporte técnico", "Usuário TC", "Usuário empresarial", "Empresa"];
const PENDING_STATUSES = ["pending", "missing", "warning", "error", "orphan"];
const MENU_MODULE_LABELS = new Map(NAV_CATALOG.map((item) => [item.id, item.label]));
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
  if (["testing_company_user", "testing-company-user", "usuario tc", "user tc", "tc user", "analista tc", "qa tc"].some((item) => normalized.includes(item))) return "Usuário TC";
  if (["company-user", "company_user", "usuario empresarial", "usuario empresa", "user company", "empresa usuario"].some((item) => normalized.includes(item))) return "Usuário empresarial";
  if (["empresa", "company", "empresas"].some((item) => normalized === item || normalized.includes(item))) return "Empresas";
  if (!normalized || normalized === "perfil nao informado" || normalized === "nao informado") return "Usuário empresarial";
  return String(value ?? "Usuário empresarial").trim();
}

function userTypeLabel(value: unknown) {
  const label = profileLabel(value);
  return label === "Empresas" ? "Empresa" : label;
}

function isLeadershipProfile(profile: string | null) {
  const value = normalize(profile);
  return value === "lider tc" || value === "suporte tecnico";
}

function isCompanyManagementProfile(profile: string | null) {
  const value = normalize(profile);
  return value === "empresas" || value === "usuario empresarial";
}

export function profileTypeForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const candidates = [metadata.profileType, metadata.accessType, metadata.permissionRole, metadata.companyRole, metadata.role, metadata.requestedRole, node.type === "profile" ? node.label : null];
  const found = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return profileLabel(found);
}

function userTypeForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const candidates = [metadata.userType, metadata.profileType, metadata.accessType, metadata.permissionRole, metadata.companyRole, metadata.role, metadata.requestedRole, node.type === "profile" ? node.label : null];
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
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isScopeHub) return true;
  return normalize(profileTypeForNode(node)) === normalize(profile) || !node.metadata?.accessType;
}

function companyMatches(node: BrainNode, companyId: string | null) {
  if (!companyId) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isScopeHub) return true;
  if (node.companyId) return node.companyId === companyId;
  const key = companyKeyForNode(node);
  return !key || key === companyId;
}

function projectMatches(node: BrainNode, projectId: string | null) {
  if (!projectId) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub || node.metadata?.isScopeHub) return true;
  return !node.projectId || node.projectId === projectId;
}

function moduleMatches(node: BrainNode, module: string | null) {
  if (!module) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub || node.metadata?.isScopeHub) return true;
  return node.module === module || moduleLabel(node.module) === module;
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
    quality: "Repositório de Testes",
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
  };
  return aliases[normalized] ?? module;
}

function moduleOrder(label: string) {
  const index = MENU_MODULE_ORDER.findIndex((item) => normalize(item) === normalize(label));
  return index === -1 ? 999 : index;
}

function qualityControlCore(nodes: BrainNode[]): BrainNode {
  return {
    id: CORE_ID,
    type: "module",
    module: "Núcleo",
    label: "Quality Control",
    description: "Núcleo principal do Brain. A leitura segue o menu lateral e a gestão de permissões: perfil, empresas, usuários, módulos e itens criados.",
    status: statusFor(nodes),
    size: "lg",
    information: `Núcleo principal com ${nodes.length} nó(s). O Brain só mostra fluxos permitidos pelo menu/permissões.` ,
    metadata: { isBrainCore: true, isContextCore: true, layer: 0, layerLabel: "0. Núcleo", count: nodes.length, pendingCount: pendingCount(nodes), profileFlow: PROFILE_FLOW },
  };
}

function profileRoot(profile: string, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => normalize(profileTypeForNode(node)) === normalize(profile));
  return {
    id: stableId("profile", profile),
    type: "profile",
    module: "1. Perfil",
    label: profile,
    description: "Primeira camada. O fluxo reflete a Gestão de Perfil e a Gestão de Usuário.",
    status: statusFor(scoped),
    size: "lg",
    information: scoped.length ? `${profile} possui ${scoped.length} nó(s) ligados ao contexto atual.` : `${profile} é uma camada de navegação controlada por permissão.`,
    metadata: { isProfileRoot: true, profileType: profile, layer: 1, layerLabel: "1. Perfil", count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function scopeHub(profile: string, scopeType: "companies" | "users" | "requests" | "agenda" | "modules", nodes: BrainNode[], viewerMode: BrainViewerMode, selectedCompanyId: string | null): BrainNode {
  const isTcUser = viewerMode === "tc_user";
  const isCompanyUser = viewerMode === "company_user";
  const labels = {
    companies: isTcUser ? "Empresas vinculadas" : isCompanyUser ? "Minha empresa" : "Empresas",
    users: "Usuários",
    modules: "Módulos permitidos",
    requests: "Solicitações Quality Control",
    agenda: "Agenda operacional",
  };
  const descriptions = {
    companies: isTcUser ? "Usuário TC precisa selecionar a empresa para ver o que criou nela." : isCompanyUser ? "Usuário empresarial visualiza a própria empresa e produção." : "Lista as empresas. Ao clicar em uma empresa, aparecem usuários, módulos e itens criados naquele contexto.",
    users: "Separa usuários por tipo: Líder TC, Suporte técnico, Usuário TC, Usuário empresarial e Empresa. Depois mostra empresas e produção criada por cada pessoa.",
    modules: "Segue o menu lateral e a tela de permissões. Se o módulo foi removido/permissão bloqueada, ele não deve virar fluxo no Brain.",
    requests: "Solicitações que podem virar empresa, usuário empresarial, usuário TC, líder ou suporte.",
    agenda: "Agenda por empresa, usuário, módulo e contexto.",
  };
  const scoped = scopeType === "requests" ? nodes.filter((node) => node.type === "access_request") : scopeType === "users" ? nodes.filter((node) => creatorKey(node)) : nodes;
  const guidance = isTcUser && scopeType === "companies" && !selectedCompanyId ? " Selecione uma empresa para liberar módulos e itens criados por esse usuário TC." : "";
  return {
    id: stableId(`scope:${profile}`, scopeType),
    type: "module",
    module: "2. Gestão",
    label: labels[scopeType],
    description: `${descriptions[scopeType]}${guidance}`,
    status: statusFor(scoped),
    size: "lg",
    information: `${descriptions[scopeType]}${guidance}`,
    metadata: { isScopeHub: true, scopeType, profileType: profile, layer: 2, layerLabel: "2. Gestão", count: scoped.length, pendingCount: pendingCount(scoped), requiresCompanySelection: isTcUser && scopeType === "companies" },
  };
}

function userTypeHub(type: string, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => normalize(userTypeForNode(node)) === normalize(type));
  return {
    id: stableId("user-type", type),
    type: "profile",
    module: "3. Tipo de usuário",
    label: type,
    description: type === "Usuário empresarial" ? "Ao abrir, selecione a empresa para ver os usuários empresariais e tudo que criaram." : type === "Usuário TC" ? "Ao abrir, selecione a empresa vinculada para ver o que esse usuário TC criou naquele contexto." : "Lista usuários deste tipo e a produção ligada aos módulos permitidos.",
    status: statusFor(scoped),
    size: "lg",
    information: `${type}: ${scoped.length} item(ns) vinculados.` ,
    metadata: { isUserTypeHub: true, userType: type, layer: 3, layerLabel: "3. Tipo de usuário", count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function companyHub(company: BrainContextCompany, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.companyId === company.id || companyKeyForNode(node) === company.id || companyNameForNode(node) === company.name);
  return {
    id: `company:${company.id}`,
    type: "company",
    module: "3. Empresa",
    label: company.name,
    description: "Empresa do menu/gestão. Dentro dela aparecem usuários, módulos e itens criados.",
    status: statusFor(scoped),
    size: "lg",
    companyId: company.id,
    companyName: company.name,
    information: `${company.name} possui ${scoped.length} nó(s) visíveis neste recorte.` ,
    metadata: { isCompanyHub: true, layer: 3, layerLabel: "3. Empresa", companyColor: colorForCompany(company.id), count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function projectHub(project: BrainContextProject, company: BrainContextCompany | null, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.projectId === project.id);
  return { id: `project:${project.id}`, type: "project", module: "3. Projeto", label: project.name, description: "Projeto selecionado dentro da empresa.", status: statusFor(scoped), size: "lg", companyId: company?.id ?? project.companyId ?? undefined, companyName: company?.name, projectId: project.id, projectName: project.name, information: `${project.name} possui ${scoped.length} nó(s).`, metadata: { isProjectHub: true, layer: 3, layerLabel: "3. Projeto", companyColor: colorForCompany(company?.id ?? project.companyId ?? null), count: scoped.length, pendingCount: pendingCount(scoped) } };
}

function moduleHub(module: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const label = moduleLabel(module);
  const scoped = nodes.filter((node) => node.module === module || moduleLabel(node.module) === label);
  return { id: `${company ? `company:${company.id}:` : ""}module:${stableId("", label)}`, type: "module", module: label, label, description: "Módulo permitido pelo menu/permissão. Ao abrir, aparecem os itens e quem criou.", status: statusFor(scoped), size: "lg", companyId: company?.id, companyName: company?.name, information: `${label} possui ${scoped.length} item(ns) neste contexto.`, metadata: { isModuleHub: true, module, moduleLabel: label, menuModule: true, layer: 4, layerLabel: "4. Módulo", companyColor: colorForCompany(company?.id ?? null), count: scoped.length, pendingCount: pendingCount(scoped) } };
}

function userHub(userKey: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const sample = nodes[0];
  const companies = uniqueById(nodes.map((node) => ({ id: companyKeyForNode(node) ?? "sem-empresa", name: companyNameForNode(node) ?? "Sem empresa" })));
  const userType = userTypeForNode(sample);
  return { id: stableId(`user:${company?.id ?? "all"}`, userKey), type: "person", module: "5. Usuário", label: userLabel(sample), description: "Usuário ligado a uma ou mais empresas. Abra para ver módulos e itens que criou.", status: statusFor(nodes), size: "md", companyId: company?.id, companyName: company?.name, information: `${userLabel(sample)} possui ${nodes.length} item(ns), atua em ${companies.length} empresa(s) e aparece como ${userType}.`, metadata: { isUserHub: true, layer: 5, layerLabel: "5. Usuário", userKey, userType, userProfiles: [userType], userCompanies: companies, companyColor: colorForCompany(company?.id ?? null), count: nodes.length, pendingCount: pendingCount(nodes) } };
}

export function getBrainProfileTypes(nodes: BrainNode[]) {
  const fromNodes = Array.from(new Set(nodes.map(profileTypeForNode).filter(Boolean)));
  return uniqueById([...PROFILE_FLOW, ...fromNodes].map((label) => ({ id: normalize(label), label }))).map((item) => item.label);
}

function groupNodesByUser(nodes: BrainNode[]) {
  const groups = new Map<string, BrainNode[]>();
  nodes.forEach((node) => {
    const key = creatorKey(node);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });
  return groups;
}

export function buildBrainProfileGraphView(options: BrainProfileGraphOptions) {
  const { nodes, edges, selectedNode, selectedProfileType, activeModule, companies, projects, selectedCompanyId, selectedProjectId, canSeeAllCompanies, hasActiveFilter, viewerMode = "unknown", viewerEmail = null } = options;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const profileTypes = getBrainProfileTypes(nodes);
  const selectedProfileFromNode = selectedNode?.metadata?.isProfileRoot ? String(selectedNode.metadata.profileType ?? selectedNode.label) : null;
  const profile = selectedProfileType ?? selectedProfileFromNode;
  const clickedUserType = selectedNode?.metadata?.isUserTypeHub ? String(selectedNode.metadata.userType ?? selectedNode.label) : null;
  const baseNodes = nodes.filter((node) => profileMatches(node, profile)).filter((node) => companyMatches(node, selectedCompanyId)).filter((node) => projectMatches(node, selectedProjectId)).filter((node) => moduleMatches(node, activeModule)).map(withCompanyColor);
  const viewerOwnNodes = viewerMode === "tc_user" || viewerMode === "company_user" ? baseNodes.filter((node) => creatorMatchesViewer(node, viewerEmail)) : baseNodes;
  const requiresCompanyForItems = viewerMode === "tc_user" && !selectedCompanyId;
  const operationalNodes = requiresCompanyForItems ? [] : viewerOwnNodes;
  const viewNodes: BrainNode[] = [];
  const viewEdges: BrainEdge[] = [];
  const coreNode = qualityControlCore(nodes);
  const profileRoots = profileTypes.map((item) => profileRoot(item, nodes));

  viewNodes.push(coreNode);
  if (!profile && !selectedNode && !activeModule && !hasActiveFilter) {
    viewNodes.push(...profileRoots);
    profileRoots.forEach((profileNode) => viewEdges.push({ id: `${CORE_ID}-${profileNode.id}`, source: CORE_ID, target: profileNode.id, label: "perfil", type: "relation", status: profileNode.status }));
    return { nodes: uniqueById(viewNodes), edges: uniqueById(viewEdges), focusNodeId: CORE_ID, focusModule: "Quality Control" };
  }

  const currentProfileNode = profileRoot(profile ?? profileTypes[0] ?? "Usuário empresarial", operationalNodes.length ? operationalNodes : baseNodes.length ? baseNodes : nodes);
  const currentProfile = String(currentProfileNode.metadata?.profileType ?? currentProfileNode.label);
  const isLeadership = viewerMode === "leadership" || isLeadershipProfile(currentProfile);
  const isCompanyLike = viewerMode === "company" || viewerMode === "company_user" || isCompanyManagementProfile(currentProfile);
  const isIndividualUser = viewerMode === "tc_user" || viewerMode === "company_user";
  viewNodes.push(currentProfileNode);
  viewEdges.push({ id: `${CORE_ID}-${currentProfileNode.id}`, source: CORE_ID, target: currentProfileNode.id, label: "perfil", type: "relation", status: currentProfileNode.status });

  const companiesScope = scopeHub(currentProfile, "companies", baseNodes, viewerMode, selectedCompanyId);
  const usersScope = scopeHub(currentProfile, "users", operationalNodes, viewerMode, selectedCompanyId);
  const modulesScope = scopeHub(currentProfile, "modules", operationalNodes, viewerMode, selectedCompanyId);
  const requestsScope = scopeHub(currentProfile, "requests", baseNodes, viewerMode, selectedCompanyId);
  const agendaScope = scopeHub(currentProfile, "agenda", operationalNodes.filter((node) => moduleLabel(node.module) === "Agenda" || node.type === "event"), viewerMode, selectedCompanyId);
  const scopeNodes = isLeadership ? [companiesScope, usersScope, modulesScope, requestsScope, agendaScope] : isCompanyLike ? [companiesScope, usersScope, modulesScope, agendaScope] : [companiesScope, usersScope, modulesScope];
  viewNodes.push(...scopeNodes);
  scopeNodes.forEach((scope) => viewEdges.push({ id: `${currentProfileNode.id}-${scope.id}`, source: currentProfileNode.id, target: scope.id, label: String(scope.metadata?.scopeType) === "requests" ? "analisa" : "gerencia", type: "relation", status: scope.status }));

  const companyOptions = selectedCompany ? [selectedCompany] : canSeeAllCompanies || viewerMode === "tc_user" ? companies : companies.slice(0, 1);
  const companyHubs = companyOptions.map((company) => companyHub(company, selectedCompanyId || viewerMode === "company_user" ? operationalNodes : baseNodes));
  viewNodes.push(...companyHubs);
  companyHubs.forEach((company) => viewEdges.push({ id: `${companiesScope.id}-${company.id}`, source: companiesScope.id, target: company.id, label: viewerMode === "tc_user" && !selectedCompanyId ? "selecione" : "empresa", type: "belongs_to_company", status: company.status, companyId: company.companyId, metadata: { companyColor: company.metadata?.companyColor } }));

  const userTypeNodes = USER_TYPE_FLOW.map((type) => userTypeHub(type, baseNodes));
  viewNodes.push(...userTypeNodes);
  userTypeNodes.forEach((node) => {
    viewEdges.push({ id: `${usersScope.id}-${node.id}`, source: usersScope.id, target: node.id, label: "tipo", type: "relation", status: node.status });
    if (["Usuário empresarial", "Usuário TC"].includes(String(node.metadata?.userType))) {
      companyHubs.forEach((company) => viewEdges.push({ id: `${node.id}-${company.id}`, source: node.id, target: company.id, label: "seleciona empresa", type: "belongs_to_company", status: company.status, companyId: company.companyId, metadata: { companyColor: company.metadata?.companyColor } }));
    }
  });

  const selectedCompanyHub = selectedCompany ? companyHubs.find((company) => company.companyId === selectedCompany.id) ?? null : companyHubs[0] ?? null;
  const selectedProjectHub = selectedProject ? projectHub(selectedProject, selectedCompany, operationalNodes) : null;
  if (selectedProjectHub) {
    viewNodes.push(selectedProjectHub);
    viewEdges.push({ id: `${selectedCompanyHub?.id ?? companiesScope.id}-${selectedProjectHub.id}`, source: selectedCompanyHub?.id ?? companiesScope.id, target: selectedProjectHub.id, label: "projeto", type: "belongs_to_project", status: selectedProjectHub.status, companyId: selectedCompany?.id, projectId: selectedProjectHub.projectId, metadata: { companyColor: selectedProjectHub.metadata?.companyColor } });
  }

  const userGroupSource = clickedUserType ? baseNodes.filter((node) => normalize(userTypeForNode(node)) === normalize(clickedUserType)) : isIndividualUser ? operationalNodes : baseNodes;
  const userGroups = groupNodesByUser(userGroupSource);
  const userNodes = Array.from(userGroups.entries()).slice(0, selectedCompany ? 18 : 14).map(([userKey, items]) => userHub(userKey, items, selectedCompany));
  viewNodes.push(...userNodes);
  userNodes.forEach((user) => {
    const typeNode = userTypeNodes.find((node) => normalize(node.metadata?.userType) === normalize(user.metadata?.userType));
    viewEdges.push({ id: `${typeNode?.id ?? usersScope.id}-${user.id}`, source: typeNode?.id ?? usersScope.id, target: user.id, label: isIndividualUser ? "meu usuário" : "usuário", type: "created_by", status: user.status, companyId: user.companyId, metadata: { companyColor: user.metadata?.companyColor } });
    const userItems = userGroups.get(String(user.metadata?.userKey)) ?? [];
    const userCompanyIds = Array.from(new Set(userItems.map(companyKeyForNode).filter((value): value is string => Boolean(value))));
    userCompanyIds.slice(0, 8).forEach((companyId) => {
      const companyNode = companyHubs.find((company) => company.companyId === companyId || company.id === `company:${companyId}`);
      if (!companyNode) return;
      viewEdges.push({ id: `${user.id}-${companyNode.id}`, source: user.id, target: companyNode.id, label: "criou na empresa", type: "belongs_to_company", status: user.status, companyId, metadata: { companyColor: companyNode.metadata?.companyColor } });
    });
  });

  const accessRequestItems = baseNodes.filter((node) => node.type === "access_request").slice(0, hasActiveFilter ? 24 : 10);
  if (isLeadership || selectedNode?.metadata?.scopeType === "requests") {
    viewNodes.push(...accessRequestItems.map((node) => ({ ...node, metadata: { ...node.metadata, isDetailNode: true, layer: 4, layerLabel: "4. Solicitação" } })));
    accessRequestItems.forEach((node) => viewEdges.push({ id: `${requestsScope.id}-${node.id}`, source: requestsScope.id, target: node.id, label: "solicitação", type: "contains", status: node.status, companyId: node.companyId, projectId: node.projectId, module: node.module, metadata: { companyColor: node.metadata?.companyColor } }));
  }

  const moduleSourceNodes = isIndividualUser ? operationalNodes : baseNodes;
  const moduleNames = Array.from(new Set(moduleSourceNodes.map((node) => node.module).filter(Boolean))).sort((a, b) => moduleOrder(moduleLabel(a)) - moduleOrder(moduleLabel(b)) || moduleLabel(a).localeCompare(moduleLabel(b), "pt-BR"));
  const moduleHubs = moduleNames.map((module) => moduleHub(module, moduleSourceNodes, selectedCompany));
  if (!requiresCompanyForItems && (selectedCompany || selectedProject || activeModule || selectedNode || hasActiveFilter || !canSeeAllCompanies || isIndividualUser)) {
    viewNodes.push(...moduleHubs);
    const moduleParent = selectedProjectHub?.id ?? selectedCompanyHub?.id ?? modulesScope.id;
    moduleHubs.forEach((module) => viewEdges.push({ id: `${moduleParent}-${module.id}`, source: moduleParent, target: module.id, label: "módulo", type: "belongs_to_module", status: module.status, companyId: selectedCompany?.id, metadata: { companyColor: module.metadata?.companyColor } }));
  }

  const clickedModule = selectedNode?.metadata?.isModuleHub ? String(selectedNode.metadata.module ?? selectedNode.module) : null;
  const clickedUserKey = selectedNode?.metadata?.isUserHub ? String(selectedNode.metadata.userKey ?? "") : null;
  const moduleFocus = activeModule ?? clickedModule;
  const itemCandidatesByModule = moduleFocus ? operationalNodes.filter((node) => node.module === moduleFocus || moduleLabel(node.module) === moduleFocus || moduleLabel(node.module) === moduleLabel(moduleFocus)) : operationalNodes;
  const itemCandidatesByUser = clickedUserKey ? itemCandidatesByModule.filter((node) => creatorKey(node) === clickedUserKey) : itemCandidatesByModule;
  const itemCandidates = clickedUserType ? itemCandidatesByUser.filter((node) => normalize(userTypeForNode(node)) === normalize(clickedUserType)) : itemCandidatesByUser;
  const showItems = !requiresCompanyForItems && Boolean(moduleFocus || clickedUserKey || clickedUserType || selectedNode?.metadata?.isCompanyHub || hasActiveFilter || (isIndividualUser && selectedCompanyId));
  const itemLimit = hasActiveFilter ? 36 : clickedUserKey || clickedUserType || isIndividualUser ? 28 : 18;
  const selectedIds = new Set<string>(selectedNode ? [selectedNode.id] : []);
  if (selectedNode && !selectedNode.metadata?.isProfileRoot && !selectedNode.metadata?.isCompanyHub && !selectedNode.metadata?.isModuleHub && !selectedNode.metadata?.isScopeHub && !selectedNode.metadata?.isUserHub && !selectedNode.metadata?.isUserTypeHub) {
    for (const edge of edges) {
      if (edge.source === selectedNode.id) selectedIds.add(edge.target);
      if (edge.target === selectedNode.id) selectedIds.add(edge.source);
    }
  }
  const detailItems = showItems ? uniqueById([...itemCandidates.filter((node) => selectedIds.has(node.id)), ...itemCandidates]).filter((node) => !node.metadata?.isProfileRoot && !node.metadata?.isCompanyHub && !node.metadata?.isModuleHub && !node.metadata?.isScopeHub).slice(0, itemLimit) : [];
  viewNodes.push(...detailItems.map((node) => ({ ...node, metadata: { ...node.metadata, isDetailNode: true, layer: 6, layerLabel: clickedUserKey || clickedUserType || isIndividualUser ? "6. Item criado" : "6. Item" } })));
  const moduleTarget = moduleFocus ? moduleHubs.find((module) => module.metadata?.module === moduleFocus || module.metadata?.moduleLabel === moduleLabel(moduleFocus))?.id ?? selectedProjectHub?.id ?? selectedCompanyHub?.id ?? modulesScope.id : clickedUserKey ? userNodes.find((user) => String(user.metadata?.userKey) === clickedUserKey)?.id ?? usersScope.id : clickedUserType ? userTypeNodes.find((node) => normalize(node.metadata?.userType) === normalize(clickedUserType))?.id ?? usersScope.id : selectedProjectHub?.id ?? selectedCompanyHub?.id ?? modulesScope.id;
  detailItems.forEach((node) => viewEdges.push({ id: `${moduleTarget}-${node.id}`, source: moduleTarget, target: node.id, label: isIndividualUser || clickedUserKey || clickedUserType ? "criou" : "item", type: "contains", status: node.status, companyId: node.companyId, projectId: node.projectId, module: node.module, metadata: { companyColor: node.metadata?.companyColor } }));

  const retainedIds = new Set(viewNodes.map((node) => node.id));
  const retainedEdges = edges.filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target)).map((edge) => ({ ...edge, metadata: { ...edge.metadata, companyColor: colorForCompany(edge.companyId ?? null) } }));
  return { nodes: uniqueById(viewNodes), edges: uniqueById([...viewEdges, ...retainedEdges]), focusNodeId: selectedNode?.id ?? currentProfileNode.id, focusModule: moduleFocus ?? clickedUserType ?? selectedProfileType ?? "Quality Control" };
}
