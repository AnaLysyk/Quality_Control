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

const COMPANY_COLORS = [
  "#67e8f9",
  "#a78bfa",
  "#34d399",
  "#facc15",
  "#fb7185",
  "#60a5fa",
  "#f472b6",
  "#2dd4bf",
];

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function stableId(prefix: string, value: unknown) {
  return `${prefix}:${normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sem-contexto"}`;
}

export function profileTypeForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  const candidates = [
    metadata.profileType,
    metadata.accessType,
    metadata.permissionRole,
    metadata.companyRole,
    metadata.role,
    metadata.requestedRole,
    node.type === "profile" ? node.label : null,
  ];

  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "Perfil nao informado";
}

function companyKeyForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  return node.companyId ?? String(metadata.companyId ?? metadata.companySlug ?? metadata.company ?? node.companyName ?? "").trim() || null;
}

function companyNameForNode(node: BrainNode) {
  const metadata = node.metadata ?? {};
  return node.companyName ?? String(metadata.companyName ?? metadata.company ?? metadata.companySlug ?? "").trim() || null;
}

function colorForCompany(companyKey: string | null) {
  if (!companyKey) return COMPANY_COLORS[0];
  const value = Array.from(companyKey).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COMPANY_COLORS[value % COMPANY_COLORS.length];
}

function withCompanyColor(node: BrainNode): BrainNode {
  const companyKey = companyKeyForNode(node);
  return {
    ...node,
    metadata: {
      ...node.metadata,
      companyColor: colorForCompany(companyKey),
      companyKey,
    },
  };
}

function profileMatches(node: BrainNode, profile: string | null) {
  if (!profile) return true;
  if (node.metadata?.isProfileRoot || node.metadata?.isContextCore) return true;
  return normalize(profileTypeForNode(node)) === normalize(profile) || !node.metadata?.accessType;
}

function companyMatches(node: BrainNode, companyId: string | null) {
  if (!companyId) return true;
  if (node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub) return true;
  if (node.companyId) return node.companyId === companyId;
  const key = companyKeyForNode(node);
  return !key || key === companyId;
}

function projectMatches(node: BrainNode, projectId: string | null) {
  if (!projectId) return true;
  if (node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub) return true;
  return !node.projectId || node.projectId === projectId;
}

function moduleMatches(node: BrainNode, module: string | null) {
  if (!module) return true;
  if (node.metadata?.isProfileRoot || node.metadata?.isContextCore || node.metadata?.isCompanyHub || node.metadata?.isModuleHub) return true;
  return node.module === module;
}

function creatorKey(node: BrainNode) {
  const metadata = node.metadata ?? {};
  return node.createdByEmail ?? node.createdBy ?? String(metadata.userEmail ?? metadata.requesterEmail ?? metadata.email ?? metadata.createdBy ?? metadata.actorEmail ?? "").trim() || null;
}

function userLabel(node: BrainNode) {
  const metadata = node.metadata ?? {};
  return node.createdByEmail ?? node.createdBy ?? String(metadata.userName ?? metadata.actorName ?? metadata.name ?? metadata.email ?? "Usuario do contexto").trim();
}

function statusFor(nodes: BrainNode[]): BrainNodeStatus {
  if (!nodes.length) return "missing";
  return nodes.some((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)) ? "pending" : "ok";
}

function profileRoot(profile: string, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => normalize(profileTypeForNode(node)) === normalize(profile));
  return {
    id: stableId("profile", profile),
    type: "profile",
    module: "Tipos de perfil",
    label: profile,
    description: "Tipo de perfil inicial do Brain. A partir dele aparecem empresas, modulos, itens e usuarios ligados ao contexto.",
    status: statusFor(scoped),
    size: "lg",
    information: `${profile} possui ${scoped.length} no(s) ligados ao contexto atual.`,
    metadata: {
      isProfileRoot: true,
      profileType: profile,
      count: scoped.length,
      pendingCount: scoped.filter((node) => ["pending", "missing", "warning", "error", "orphan"].includes(node.status)).length,
    },
  };
}

function companyHub(company: BrainContextCompany, nodes: BrainNode[]): BrainNode {
  const scoped = nodes.filter((node) => node.companyId === company.id || companyKeyForNode(node) === company.id || companyNameForNode(node) === company.name);
  return {
    id: `company:${company.id}`,
    type: "company",
    module: "Empresas",
    label: company.name,
    description: "Empresa no nucleo do Brain. Dentro dela aparecem usuarios, modulos, defeitos, runs, planos, documentos e movimentacoes.",
    status: statusFor(scoped),
    size: "lg",
    companyId: company.id,
    companyName: company.name,
    information: `${company.name} possui ${scoped.length} no(s) visiveis neste recorte.`,
    metadata: {
      isCompanyHub: true,
      companyColor: colorForCompany(company.id),
      count: scoped.length,
    },
  };
}

function moduleHub(module: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const scoped = nodes.filter((node) => node.module === module);
  return {
    id: `${company ? `company:${company.id}:` : ""}module:${module}`,
    type: "module",
    module,
    label: module,
    description: "Modulo dentro da empresa selecionada. Ao abrir, aparecem os itens do modulo e o usuario que criou ou movimentou cada item.",
    status: statusFor(scoped),
    size: "lg",
    companyId: company?.id,
    companyName: company?.name,
    information: `${module} possui ${scoped.length} item(ns) neste contexto.`,
    metadata: {
      isModuleHub: true,
      module,
      companyColor: colorForCompany(company?.id ?? null),
      count: scoped.length,
    },
  };
}

function userHub(userKey: string, nodes: BrainNode[], company: BrainContextCompany | null): BrainNode {
  const sample = nodes[0];
  return {
    id: stableId(`user:${company?.id ?? "all"}`, userKey),
    type: "person",
    module: "Usuarios",
    label: userLabel(sample),
    description: "Usuario/autor ligado aos itens criados ou movimentados no contexto selecionado.",
    status: statusFor(nodes),
    size: "md",
    companyId: company?.id,
    companyName: company?.name,
    information: `${userLabel(sample)} possui ${nodes.length} item(ns) ligados ao contexto atual.`,
    metadata: {
      isUserHub: true,
      userKey,
      companyColor: colorForCompany(company?.id ?? null),
      count: nodes.length,
    },
  };
}

export function getBrainProfileTypes(nodes: BrainNode[]) {
  return Array.from(new Set(nodes.map(profileTypeForNode).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function buildBrainProfileGraphView(options: BrainProfileGraphOptions) {
  const {
    nodes,
    edges,
    selectedNode,
    selectedProfileType,
    activeModule,
    companies,
    projects,
    selectedCompanyId,
    selectedProjectId,
    canSeeAllCompanies,
    hasActiveFilter,
  } = options;

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const profileTypes = getBrainProfileTypes(nodes);
  const profile = selectedProfileType ?? (selectedNode?.metadata?.isProfileRoot ? String(selectedNode.metadata.profileType ?? selectedNode.label) : null);
  const baseNodes = nodes
    .filter((node) => profileMatches(node, profile))
    .filter((node) => companyMatches(node, selectedCompanyId))
    .filter((node) => projectMatches(node, selectedProjectId))
    .filter((node) => moduleMatches(node, activeModule))
    .map(withCompanyColor);

  const viewNodes: BrainNode[] = [];
  const viewEdges: BrainEdge[] = [];

  const profileRoots = profileTypes.map((item) => profileRoot(item, nodes));

  if (!profile && !selectedNode && !activeModule && !hasActiveFilter) {
    return {
      nodes: profileRoots,
      edges: [],
      focusNodeId: null,
      focusModule: "Tipos de perfil",
    };
  }

  const currentProfileNode = profileRoot(profile ?? profileTypes[0] ?? "Perfil nao informado", baseNodes.length ? baseNodes : nodes);
  viewNodes.push(currentProfileNode);

  const companyOptions = selectedCompany
    ? [selectedCompany]
    : canSeeAllCompanies
      ? companies
      : companies.slice(0, 1);

  const companyHubs = companyOptions.map((company) => companyHub(company, baseNodes));
  viewNodes.push(...companyHubs);
  companyHubs.forEach((company) => {
    viewEdges.push({
      id: `${currentProfileNode.id}-${company.id}`,
      source: currentProfileNode.id,
      target: company.id,
      label: "atua em",
      type: "belongs_to_company",
      status: company.status,
      companyId: company.companyId,
      metadata: { companyColor: company.metadata?.companyColor },
    });
  });

  const selectedCompanyHub = selectedCompany ? companyHubs.find((company) => company.companyId === selectedCompany.id) ?? null : companyHubs[0] ?? null;
  const moduleNames = Array.from(new Set(baseNodes.map((node) => node.module).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const moduleHubs = moduleNames.map((module) => moduleHub(module, baseNodes, selectedCompany));

  if (selectedCompany || activeModule || selectedNode || hasActiveFilter || !canSeeAllCompanies) {
    viewNodes.push(...moduleHubs);
    moduleHubs.forEach((module) => {
      viewEdges.push({
        id: `${selectedCompanyHub?.id ?? currentProfileNode.id}-${module.id}`,
        source: selectedCompanyHub?.id ?? currentProfileNode.id,
        target: module.id,
        label: "possui modulo",
        type: "belongs_to_module",
        status: module.status,
        companyId: selectedCompany?.id,
        metadata: { companyColor: module.metadata?.companyColor },
      });
    });
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

  const detailItems = showItems
    ? uniqueById([
        ...itemCandidates.filter((node) => selectedIds.has(node.id)),
        ...itemCandidates,
      ]).filter((node) => !node.metadata?.isProfileRoot && !node.metadata?.isCompanyHub && !node.metadata?.isModuleHub).slice(0, itemLimit)
    : [];

  viewNodes.push(...detailItems.map((node) => ({
    ...node,
    metadata: {
      ...node.metadata,
      isDetailNode: true,
    },
  })));

  const moduleTarget = moduleFocus
    ? moduleHubs.find((module) => module.module === moduleFocus)?.id ?? selectedCompanyHub?.id ?? currentProfileNode.id
    : selectedCompanyHub?.id ?? currentProfileNode.id;

  detailItems.forEach((node) => {
    viewEdges.push({
      id: `${moduleTarget}-${node.id}`,
      source: moduleTarget,
      target: node.id,
      label: "contem item",
      type: "contains",
      status: node.status,
      companyId: node.companyId,
      projectId: node.projectId,
      module: node.module,
      metadata: { companyColor: node.metadata?.companyColor },
    });
  });

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
    userItems.slice(0, 8).forEach((item) => {
      viewEdges.push({
        id: `${item.id}-${user.id}`,
        source: item.id,
        target: user.id,
        label: "criado/movimentado por",
        type: "created_by",
        status: item.status,
        companyId: item.companyId,
        projectId: item.projectId,
        module: item.module,
        metadata: { companyColor: item.metadata?.companyColor },
      });
    });
  });

  const retainedIds = new Set(viewNodes.map((node) => node.id));
  const retainedEdges = edges
    .filter((edge) => retainedIds.has(edge.source) && retainedIds.has(edge.target))
    .map((edge) => ({
      ...edge,
      metadata: {
        ...edge.metadata,
        companyColor: colorForCompany(edge.companyId ?? null),
      },
    }));

  return {
    nodes: uniqueById(viewNodes),
    edges: uniqueById([...viewEdges, ...retainedEdges]),
    focusNodeId: selectedNode?.id ?? currentProfileNode.id,
    focusModule: moduleFocus ?? selectedProfileType ?? "Tipos de perfil",
  };
}
