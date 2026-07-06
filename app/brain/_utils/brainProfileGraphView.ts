import type { BrainContextCompany, BrainContextProject, BrainEdge, BrainNode, BrainNodeStatus } from "../_types/brain.types";

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
};

const COMPANY_COLORS = ["#67e8f9", "#a78bfa", "#34d399", "#facc15", "#fb7185", "#60a5fa", "#f472b6", "#2dd4bf"];
const CORE_ID = "quality-control-core";
const PROFILE_FLOW = ["Líder TC", "Suporte técnico", "Usuário empresarial", "Empresas"];
const PENDING_STATUSES = ["pending", "missing", "warning", "error", "orphan"];

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
  if (["company-user", "company_user", "usuario empresarial", "usuario empresa", "user company"].some((item) => normalized.includes(item))) return "Usuário empresarial";
  if (["empresa", "company", "empresas"].some((item) => normalized === item || normalized.includes(item))) return "Empresas";
  if (!normalized || normalized === "perfil nao informado" || normalized === "nao informado") return "Usuário empresarial";
  return String(value ?? "Usuário empresarial").trim();
}

export function profileTypeForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const candidates = [metadata.profileType, metadata.accessType, metadata.permissionRole, metadata.companyRole, metadata.role, metadata.requestedRole, node.type === "profile" ? node.label : null];
  const found = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return profileLabel(found);
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
  return { ...node, metadata: { ...node.metadata, companyColor: colorForCompany(companyKey), companyKey } };
}

function profileMatches(node: BrainNode, profile: string | null) {
  if (!profile) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore) return true;
  return normalize(profileTypeForNode(node)) === normalize(profile) || !node.metadata?.accessType;
}

function companyMatches(node: BrainNode, companyId: string | null) {
  if (!companyId) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub) return true;
  if (node.companyId) return node.companyId === companyId;
  const key = companyKeyForNode(node);
  return !key || key === companyId;
}

function projectMatches(node: BrainNode, projectId: string | null) {
  if (!projectId) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub) return true;
  return !node.projectId || node.projectId === projectId;
}

function moduleMatches(node: BrainNode, module: string | null) {
  if (!module) return true;
  if (node.metadata?.isBrainCore || node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub) return true;
  return node.module === module;
}

function creatorKey(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const key = node.createdByEmail ?? node.createdBy ?? String(metadata.userEmail ?? metadata.requesterEmail ?? metadata.email ?? metadata.createdBy ?? metadata.actorEmail ?? "").trim();
  return key || null;
}

function userLabel(node: BrainNode) {
  const metadata = node.metadata ?? {};
  return node.createdByEmail ?? node.createdBy ?? String(metadata.userName ?? metadata.actorName ?? metadata.name ?? metadata.email ?? "Usuário do contexto").trim();
}

function statusFor(nodes: BrainNode[]): BrainNodeStatus {
  if (!nodes.length) return "ok";
  return nodes.some((node) => PENDING_STATUSES.includes(node.status)) ? "pending" : "ok";
}

function pendingCount(nodes: BrainNode[]) {
  return nodes.filter((node) => PENDING_STATUSES.includes(node.status)).length;
}

function qualityControlCore(nodes: BrainNode[]): BrainNode {
  return {
    id: CORE_ID,
    type: "module",
    module: "Núcleo",
    label: "Quality Control",
    description: "Núcleo principal do Brain. A leitura sempre começa aqui: perfil, depois empresa/projeto, depois módulo e por último o dado.",
    status: statusFor(nodes),
    size: "lg",
    information: `Núcleo principal com ${nodes.length} nó(s) disponíveis para navegação.`,
    metadata: {
      isBrainCore: true,
      isContextCore: true,
      layer: 0,
      layerLabel: "0. Núcleo",
      count: nodes.length,
      pendingCount: pendingCount(nodes),
      profileFlow: PROFILE_FLOW,
    },
  };
}

function profileRoot(profile: string, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => normalize(profileTypeForNode(node)) === normalize(profile));
  return {
    id: stableId("profile", profile),
    type: "profile",
    module: "1. Perfil",
    label: profile,
    description: "Primeira camada depois do núcleo. Clique em um perfil para abrir empresas, projetos, módulos e dados ligados a esse perfil.",
    status: statusFor(scoped),
    size: "lg",
    information: scoped.length ? `${profile} possui ${scoped.length} nó(s) ligados ao contexto atual.` : `${profile} é uma camada de navegação. Selecione para ver o recorte disponível.`,
    metadata: { isProfileRoot: true, profileType: profile, layer: 1, layerLabel: "1. Perfil", count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function companyHub(company: BrainContextCompany, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.companyId === company.id || companyKeyForNode(node) === company.id || companyNameForNode(node) === company.name);
  return {
    id: `company:${company.id}`,
    type: "company",
    module: "2. Empresa",
    label: company.name,
    description: "Segunda camada do Brain. Dentro da empresa aparecem projetos, módulos, usuários e dados.",
    status: statusFor(scoped),
    size: "lg",
    companyId: company.id,
    companyName: company.name,
    information: `${company.name} possui ${scoped.length} nó(s) visíveis neste recorte.`,
    metadata: { isCompanyHub: true, layer: 2, layerLabel: "2. Empresa", companyColor: colorForCompany(company.id), count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function projectHub(project: BrainContextProject, company: BrainContextCompany | null, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.projectId === project.id);
  return {
    id: `project:${project.id}`,
    type: "project",
    module: "2. Projeto",
    label: project.name,
    description: "Projeto selecionado dentro da empresa. Ele limita módulos, itens, ações e usuários ao contexto correto.",
    status: statusFor(scoped),
    size: "lg",
    companyId: company?.id ?? project.companyId ?? undefined,
    companyName: company?.name,
    projectId: project.id,
    projectName: project.name,
    information: `${project.name} possui ${scoped.length} nó(s) no recorte atual.`,
    metadata: { isProjectHub: true, layer: 2, layerLabel: "2. Projeto", companyColor: colorForCompany(company?.id ?? project.companyId ?? null), count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function moduleHub(module: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const scoped = nodes.filter((node) => node.module === module);
  return {
    id: `${company ? `company:${company.id}:` : ""}module:${module}`,
    type: "module",
    module: "3. Módulo",
    label: module,
    description: "Terceira camada. Ao abrir um módulo, aparecem os dados e usuários ligados a ele.",
    status: statusFor(scoped),
    size: "lg",
    companyId: company?.id,
    companyName: company?.name,
    information: `${module} possui ${scoped.length} item(ns) neste contexto.`,
    metadata: { isModuleHub: true, module, layer: 3, layerLabel: "3. Módulo", companyColor: colorForCompany(company?.id ?? null), count: scoped.length, pendingCount: pendingCount(scoped) },
  };
}

function userHub(userKey: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const sample = nodes[0];
  return {
    id: stableId(`user:${company?.id ?? "all"}`, userKey),
    type: "person",
    module: "Usuários",
    label: userLabel(sample),
    description: "Usuário/autor ligado aos itens criados ou movimentados no contexto selecionado.",
    status: statusFor(nodes),
    size: "md",
    companyId: company?.id,
    companyName: company?.name,
    information: `${userLabel(sample)} possui ${nodes.length} item(ns) ligados ao contexto atual.`,
    metadata: { isUserHub: true, layer: 4, layerLabel: "4. Usuário", userKey, companyColor: colorForCompany(company?.id ?? null), count: nodes.length, pendingCount: pendingCount(nodes) },
  };
}

export function getBrainProfileTypes(nodes: BrainNode[]) {
  const fromNodes = Array.from(new Set(nodes.map(profileTypeForNode).filter(Boolean)));
  return uniqueById([...PROFILE_FLOW, ...fromNodes].map((label) => ({ id: normalize(label), label }))).map((item) => item.label);
}

export function buildBrainProfileGraphView(options: BrainProfileGraphOptions) {
  const { nodes, edges, selectedNode, selectedProfileType, activeModule, companies, projects, selectedCompanyId, selectedProjectId, canSeeAllCompanies, hasActiveFilter } = options;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const profileTypes = getBrainProfileTypes(nodes);
  const selectedProfileFromNode = selectedNode?.metadata?.isProfileRoot ? String(selectedNode.metadata.profileType ?? selectedNode.label) : null;
  const profile = selectedProfileType ?? selectedProfileFromNode;
  const baseNodes = nodes.filter((node) => profileMatches(node, profile)).filter((node) => companyMatches(node, selectedCompanyId)).filter((node) => projectMatches(node, selectedProjectId)).filter((node) => moduleMatches(node, activeModule)).map(withCompanyColor);
  const viewNodes: BrainNode[] = [];
  const viewEdges: BrainEdge[] = [];
  const coreNode = qualityControlCore(nodes);
  const profileRoots = profileTypes.map((item) => profileRoot(item, nodes));

  viewNodes.push(coreNode);

  if (!profile && !selectedNode && !activeModule && !hasActiveFilter) {
    viewNodes.push(...profileRoots);
    profileRoots.forEach((profileNode) => viewEdges.push({
      id: `${CORE_ID}-${profileNode.id}`,
      source: CORE_ID,
      target: profileNode.id,
      label: "1 perfil",
      type: "relation",
      status: profileNode.status,
    }));
    return { nodes: uniqueById(viewNodes), edges: uniqueById(viewEdges), focusNodeId: CORE_ID, focusModule: "Quality Control" };
  }

  const currentProfileNode = profileRoot(profile ?? profileTypes[0] ?? "Usuário empresarial", baseNodes.length ? baseNodes : nodes);
  viewNodes.push(currentProfileNode);
  viewEdges.push({ id: `${CORE_ID}-${currentProfileNode.id}`, source: CORE_ID, target: currentProfileNode.id, label: "1 perfil", type: "relation", status: currentProfileNode.status });

  const companyOptions = selectedCompany ? [selectedCompany] : canSeeAllCompanies ? companies : companies.slice(0, 1);
  const companyHubs = companyOptions.map((company) => companyHub(company, baseNodes));
  viewNodes.push(...companyHubs);
  companyHubs.forEach((company) => viewEdges.push({ id: `${currentProfileNode.id}-${company.id}`, source: currentProfileNode.id, target: company.id, label: "2 empresa", type: "belongs_to_company", status: company.status, companyId: company.companyId, metadata: { companyColor: company.metadata?.companyColor } }));

  const selectedCompanyHub = selectedCompany ? companyHubs.find((company) => company.companyId === selectedCompany.id) ?? null : companyHubs[0] ?? null;
  const selectedProjectHub = selectedProject ? projectHub(selectedProject, selectedCompany, baseNodes) : null;
  if (selectedProjectHub) {
    viewNodes.push(selectedProjectHub);
    viewEdges.push({ id: `${selectedCompanyHub?.id ?? currentProfileNode.id}-${selectedProjectHub.id}`, source: selectedCompanyHub?.id ?? currentProfileNode.id, target: selectedProjectHub.id, label: "2 projeto", type: "belongs_to_project", status: selectedProjectHub.status, companyId: selectedCompany?.id, projectId: selectedProjectHub.projectId, metadata: { companyColor: selectedProjectHub.metadata?.companyColor } });
  }

  const moduleNames = Array.from(new Set(baseNodes.map((node) => node.module).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const moduleHubs = moduleNames.map((module) => moduleHub(module, baseNodes, selectedCompany));
  if (selectedCompany || selectedProject || activeModule || selectedNode || hasActiveFilter || !canSeeAllCompanies) {
    viewNodes.push(...moduleHubs);
    moduleHubs.forEach((module) => viewEdges.push({ id: `${selectedProjectHub?.id ?? selectedCompanyHub?.id ?? currentProfileNode.id}-${module.id}`, source: selectedProjectHub?.id ?? selectedCompanyHub?.id ?? currentProfileNode.id, target: module.id, label: "3 módulo", type: "belongs_to_module", status: module.status, companyId: selectedCompany?.id, metadata: { companyColor: module.metadata?.companyColor } }));
  }

  const clickedModule = selectedNode?.metadata?.isModuleHub ? String(selectedNode.metadata.module ?? selectedNode.module) : null;
  const moduleFocus = activeModule ?? clickedModule;
  const itemCandidates = moduleFocus ? baseNodes.filter((node) => node.module === moduleFocus && !node.metadata?.isProfileRoot) : baseNodes;
  const showItems = Boolean(moduleFocus || selectedNode || hasActiveFilter);
  const itemLimit = hasActiveFilter ? 32 : 18;
  const selectedIds = new Set<string>(selectedNode ? [selectedNode.id] : []);

  if (selectedNode && !selectedNode.metadata?.isProfileRoot && !selectedNode.metadata?.isCompanyHub && !selectedNode.metadata?.isModuleHub) {
    for (const edge of edges) {
      if (edge.source === selectedNode.id) selectedIds.add(edge.target);
      if (edge.target === selectedNode.id) selectedIds.add(edge.source);
    }
  }

  const detailItems = showItems ? uniqueById([...itemCandidates.filter((node) => selectedIds.has(node.id)), ...itemCandidates]).filter((node) => !node.metadata?.isProfileRoot && !node.metadata?.isCompanyHub && !node.metadata?.isModuleHub).slice(0, itemLimit) : [];
  viewNodes.push(...detailItems.map((node) => ({ ...node, metadata: { ...node.metadata, isDetailNode: true, layer: 4, layerLabel: "4. Dado" } })));

  const moduleTarget = moduleFocus ? moduleHubs.find((module) => module.metadata?.module === moduleFocus)?.id ?? selectedProjectHub?.id ?? selectedCompanyHub?.id ?? currentProfileNode.id : selectedProjectHub?.id ?? selectedCompanyHub?.id ?? currentProfileNode.id;
  detailItems.forEach((node) => viewEdges.push({ id: `${moduleTarget}-${node.id}`, source: moduleTarget, target: node.id, label: "4 dado", type: "contains", status: node.status, companyId: node.companyId, projectId: node.projectId, module: node.module, metadata: { companyColor: node.metadata?.companyColor } }));

  const userGroups = new Map<string, BrainNode[]>();
  detailItems.forEach((node) => {
    const key = creatorKey(node);
    if (!key) return;
    userGroups.set(key, [...(userGroups.get(key) ?? []), node]);
  });
  const userNodes = Array.from(userGroups.entries()).slice(0, 12).map(([userKey, items]) => userHub(userKey, items, selectedCompany));
  viewNodes.push(...userNodes);
  userNodes.forEach((user) => {
    const userItems = userGroups.get(String(user.metadata?.userKey)) ?? [];
    userItems.slice(0, 8).forEach((item) => viewEdges.push({ id: `${item.id}-${user.id}`, source: item.id, target: user.id, label: "usuário", type: "created_by", status: item.status, companyId: item.companyId, projectId: item.projectId, module: item.module, metadata: { companyColor: item.metadata?.companyColor } }));
  });

  const retainedIds = new Set(viewNodes.map((node) => node.id));
  const retainedEdges = edges.filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target)).map((edge) => ({ ...edge, metadata: { ...edge.metadata, companyColor: colorForCompany(edge.companyId ?? null) } }));

  return { nodes: uniqueById(viewNodes), edges: uniqueById([...viewEdges, ...retainedEdges]), focusNodeId: selectedNode?.id ?? currentProfileNode.id, focusModule: moduleFocus ?? selectedProfileType ?? "Quality Control" };
}
