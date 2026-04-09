"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiChevronDown, FiMaximize2, FiMessageSquare, FiPaperclip, FiSearch, FiSend, FiX } from "react-icons/fi";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useI18n } from "@/hooks/useI18n";
import { fetchApi } from "@/lib/api";
import { calcMTTR } from "@/lib/mttr";
import { normalizeDefectStatus, resolveClosedAt, resolveOpenedAt } from "@/lib/defectNormalization";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import { slugifyRelease } from "@/lib/slugifyRelease";

type CompanyDefect = {
  id: string;
  slug: string;
  title: string;
  name: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  runSlug: string | null;
  runName: string | null;
  runId: number | null;
  sourceType: "manual" | "qase";
  projectCode: string | null;
  applicationName: string | null;
  description: string | null;
  severity: string | number | null;
  priority: string | null;
  externalUrl: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  environments: string[];
  commentsCount: number;
  lastCommentAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canComment: boolean;
};

type ResponsibleOption = {
  userId: string;
  label: string;
  name: string;
  email: string | null;
};

type ApplicationCatalogOption = {
  name: string;
  projectCode: string | null;
  source: "manual" | "qase" | "mixed";
};

type RunCatalogOption = {
  slug: string;
  name: string;
  createdAt: string | null;
  applicationName: string | null;
  projectCode: string | null;
  source: "manual" | "qase";
};

type ManualRunRecord = {
  slug?: string | null;
  name?: string | null;
  app?: string | null;
  qaseProject?: string | null;
  createdAt?: string | null;
  kind?: string | null;
};

type IntegratedRunRecord = {
  slug?: string | null;
  title?: string | null;
  name?: string | null;
  app?: string | null;
  project?: string | null;
  qaseProject?: string | null;
  createdAt?: string | null;
};

type IntegrationProvider = "qase" | "jira";

type DefectComment = {
  id: string;
  body: string;
  authorId?: string | null;
  authorName?: string | null;
  createdAt: string;
};

type DefectHistoryEvent = {
  id: string;
  action: string;
  createdAt: string;
  source?: "internal" | "qase";
  actorId?: string | null;
  actorName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromRunSlug?: string | null;
  toRunSlug?: string | null;
  note?: string | null;
};

type DefectEvidenceLink = {
  raw: string;
  label: string;
  href: string;
};

type OverviewResponse = {
  items?: CompanyDefect[];
  warning?: string | null;
  applications?: ApplicationCatalogOption[];
  integration?: {
    hasQaseToken?: boolean;
    hasJiraToken?: boolean;
    activeProviders?: IntegrationProvider[];
    projectCodes?: string[];
    blockedProjects?: Array<{
      projectCode?: string | null;
      accessible?: boolean;
      reason?: "ok" | "unauthorized" | "error" | null;
      message?: string | null;
      defectsCount?: number;
    }>;
  };
  responsibleOptions?: ResponsibleOption[];
  permissions?: {
    canCreate?: boolean;
    canEditManual?: boolean;
    canDeleteManual?: boolean;
    canAssignIntegrated?: boolean;
    canComment?: boolean;
  };
  message?: string;
};

type ActivityResponse = {
  comments?: DefectComment[];
  history?: DefectHistoryEvent[];
  timelineNotice?: string | null;
  summary?: {
    assignedToUserId?: string | null;
    assignedToName?: string | null;
    commentsCount?: number;
    lastCommentAt?: string | null;
  };
  message?: string;
};

type ManualDefectMutationResponse = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  status?: string | null;
  app?: string | null;
  qaseProject?: string | null;
  observations?: string | null;
  severity?: string | number | null;
  priority?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  closedAt?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  runSlug?: string | null;
  runName?: string | null;
  runId?: number | string | null;
  environments?: string[] | null;
  message?: string;
};

type BlockedQaseProject = {
  projectCode: string;
  reason: "unauthorized" | "error";
  message: string | null;
  defectsCount: number;
};

type DefectFormState = {
  title: string;
  description: string;
  applicationName: string;
  projectCode: string;
  status: string;
  severity: string;
  priority: string;
  assignedToUserId: string;
  runSlug: string;
  environments: string;
};

type FilterState = {
  search: string;
  source: "all" | "manual" | "qase";
  application: string;
  project: string;
  startDate: string;
  endDate: string;
  status: "all" | "open" | "in_progress" | "done";
  responsible: string;
};

const EMPTY_PERMISSIONS = {
  canCreate: false,
  canEditManual: false,
  canDeleteManual: false,
  canAssignIntegrated: false,
  canComment: false,
};

const EMPTY_FILTERS: FilterState = {
  search: "",
  source: "all",
  application: "",
  project: "",
  startDate: "",
  endDate: "",
  status: "all",
  responsible: "",
};

const DEFECT_STATUS_OPTIONS = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "done", label: "Concluído" },
] as const;

const DEFECT_SEVERITY_OPTIONS = [
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const;

const DEFECT_PRIORITY_OPTIONS = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const;

const COMMENT_MAX_LENGTH = 2000;
const DEFECT_EVIDENCE_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

const DEFECTS_COPY = {
  "pt-BR": {
    common: {
      company: "Empresa",
      emptyValue: "--",
      system: "Sistema",
      integration: "Integração",
    },
    hero: {
      kicker: "Painel {company}",
      title: "Defeitos",
      subtitle: "Base unificada para triagem, leitura e acompanhamento dos defeitos visíveis no contexto atual.",
      qaseConnected: "Qase conectado",
      integrationStatus: "Status da integração: {value}",
      newDefect: "Novo defeito",
    },
    metrics: {
      openTitle: "Defeitos abertos",
      openDescription: "Itens fora de concluído no recorte atual.",
      qaseTitle: "Qase integrados",
      qaseDescription: "Total trazido da integração com o Qase.",
      manualTitle: "Manuais",
      manualDescription: "Itens internos criados na plataforma.",
      mttrTitle: "MTTR médio",
      mttrDescription: "Tempo médio de resolução dos itens concluídos.",
    },
    source: {
      manual: "Manual",
      qase: "Qase",
      mixed: "Misto",
      qaseSuffix: " - Qase",
      mixedSuffix: " - Misto",
      filterAll: "Origem: todas",
      chipQase: "Origem Qase",
      chipManual: "Origem manual",
      label: "Origem",
    },
    status: {
      open: "Aberto",
      inProgress: "Em andamento",
      done: "Concluído",
      label: "Status",
      filterAll: "Status: todos",
      prefix: "Status: {value}",
    },
    severity: {
      critical: "Crítica",
      high: "Alta",
      medium: "Média",
      low: "Baixa",
      none: "Sem severidade",
      label: "Severidade",
      prefix: "Severidade: {value}",
    },
    priority: {
      high: "Alta",
      medium: "Média",
      low: "Baixa",
      none: "Sem prioridade",
      label: "Prioridade",
      prefix: "Prioridade: {value}",
    },
    blocked: {
      badge: "Projetos Qase indisponíveis",
      title: "Alguns projetos não puderam ser consultados agora",
      description:
        "Esses projetos foram removidos dos filtros, da vinculação manual e do catálogo de aplicações até a integração voltar a responder com segurança.",
      blockedProjects: "Projetos bloqueados",
      blockedProjectsDescription: "Não entram nos seletores enquanto o acesso não for normalizado.",
      unauthorized: "Sem autorização",
      unauthorizedDescription: "Token sem permissão suficiente para ler o projeto no Qase.",
      technicalFailure: "Falha técnica",
      technicalFailureDescription: "Projeto inválido, rota incorreta ou erro de integração retornado pela API.",
      unauthorizedPill: "Sem autorização",
      integrationFailurePill: "Falha de integração",
      whyUnavailable: "Por que ficou indisponível",
      returnedDetail: "Detalhe retornado",
      howToFix: "Como corrigir",
      noTechnicalDetail: "Nenhum detalhe técnico foi retornado pela integração.",
      unauthorizedReason: "Sem autorização para consultar os defeitos desse projeto no Qase.",
      genericReason: "A integração não conseguiu consultar esse projeto no Qase.",
      unauthorizedAction:
        "Revise o token salvo e confirme se ele possui acesso de leitura a esse projeto dentro do Qase.",
      duplicatedBaseUrlAction:
        "A URL base da integração está duplicando /v1. Corrija a configuração da empresa para usar apenas o domínio base da API do Qase.",
      notFoundAction:
        "Valide se o código do projeto está correto no cadastro da empresa e se ele realmente existe no workspace do Qase.",
      genericAction:
        "Valide a configuração do projeto e a conectividade da integração antes de liberar esse item novamente na plataforma.",
    },
    filters: {
      kicker: "Filtros operacionais",
      title: "Controle do painel",
      subtitle: "Ajuste o recorte por origem, aplicação, status e responsável.",
      clear: "Limpar filtros",
      searchPlaceholder: "Buscar por título, descrição e run...",
      searchAria: "Buscar defeitos",
      applicationAll: "Aplicação: todas",
      startDateAria: "Filtrar defeitos pela data inicial de criação",
      endDateAria: "Filtrar defeitos pela data final de criação",
      projectAll: "Projeto: todos",
      responsibleAll: "Responsável: todos",
      responsibleAria: "Filtrar defeitos por responsável",
      applicationAria: "Filtrar defeitos por aplicação",
      projectAria: "Filtrar defeitos por projeto",
      sourceAria: "Filtrar defeitos por origem",
      statusAria: "Filtrar defeitos por status",
      unassigned: "Sem responsável",
      chipRun: "Run {value}",
      chipApplication: "Aplicação {value}",
      chipDateFrom: "De {value}",
      chipDateTo: "Até {value}",
      chipDateRange: "Período {from} - {to}",
      chipProject: "Projeto {value}",
      chipStatus: "Status {value}",
      chipResponsible: "Responsável {value}",
      chipSearch: 'Busca "{value}"',
    },
    list: {
      kicker: "Base operacional",
      title: "Defeitos visíveis",
      subtitle: "Cards com leitura rápida, detalhe, comentários e responsável.",
      cardsCount: "{count} cards",
      reload: "Recarregar dados",
      loading: "Carregando defeitos...",
      emptyTitle: "Nenhum defeito encontrado.",
      emptyDescription:
        "Recarregue os dados da integração, revise a base vinculada da empresa ou crie um defeito manual para iniciar o painel.",
      filteredEmptyTitle: "Nenhum defeito encontrado com os filtros atuais.",
      filteredEmptyDescription: "Revise os filtros aplicados ou recarregue os dados para atualizar a base exibida.",
      createManual: "Criar defeito manual",
      viewDetails: "Ver detalhe",
      openInQase: "Abrir no Qase",
      commentsCount: "{count} comentário(s)",
      application: "Aplicação",
      project: "Projeto",
      responsible: "Responsável",
      severity: "Severidade",
      priority: "Prioridade",
      notDefined: "Não definido",
      createdAt: "Criado em",
      run: "Run",
      createdBy: "Criado por",
      lastComment: "Último comentário",
      mttr: "MTTR",
    },
    create: {
      kicker: "Novo defeito manual",
      title: "Registrar defeito",
      subtitle: "Cadastre um defeito interno sem tirar o foco da base operacional.",
      closeAria: "Fechar criação de defeito",
      closeTitle: "Fechar",
      titlePlaceholder: "Título do defeito",
      selectApplication: "Selecionar aplicação",
      otherApplication: "Outra aplicação",
      customApplicationPlaceholder: "Aplicação",
      selectProject: "Projeto / código Qase",
      customProjectPlaceholder: "Projeto / código Qase",
      selectApplicationAria: "Selecionar aplicação do defeito",
      selectProjectAria: "Selecionar projeto Qase do defeito",
      selectStatusAria: "Selecionar status do defeito manual",
      selectSeverityAria: "Selecionar severidade do defeito manual",
      selectPriorityAria: "Selecionar prioridade do defeito manual",
      runSelectAria: "Selecionar run vinculada ao defeito manual",
      runSearchPlaceholder: "Buscar run da aplica??o",
      runEmpty: "Nenhuma run encontrada para a aplica??o selecionada.",
      runClear: "Sem run vinculada",
      descriptionPlaceholder: "Descrição do defeito",
      environmentsPlaceholder: "Ambientes (separados por vírgula)",
      cancel: "Cancelar",
      creating: "Criando...",
      submit: "Criar defeito",
      manualApplicationFallback: "Aplicação manual",
    },
    detail: {
      kicker: "Defeitos",
      summary: "Resumo executivo",
      manualDescription: "Defeito manual com edição operacional, comentários internos e acompanhamento completo.",
      qaseDescription: "Defeito sincronizado do Qase com colaboração interna e responsável local.",
      closeAria: "Fechar detalhes do defeito",
      closeTitle: "Fechar",
      openOriginal: "Abrir item original no Qase",
      operationalFields: "Campos operacionais",
      titlePlaceholder: "Título",
      descriptionPlaceholder: "Descrição",
      applicationPlaceholder: "Aplicação",
      projectPlaceholder: "Projeto / código Qase",
      runPlaceholder: "Run vinculada",
      environmentsPlaceholder: "Ambientes",
      statusAria: "Status do defeito",
      severityAria: "Severidade do defeito",
      priorityAria: "Prioridade do defeito",
      responsibleAria: "Responsável do defeito",
      runSelectAria: "Selecionar run vinculada ao defeito",
      runSearchPlaceholder: "Buscar run da aplica??o",
      runEmpty: "Nenhuma run encontrada para a aplica??o selecionada.",
      runClear: "Sem run vinculada",
      remove: "Remover defeito",
      saveChanges: "Salvar alterações",
      saveAssignee: "Salvar responsável interno",
    },
    comments: {
      title: "Comentários internos",
      subtitle: "Conversa operacional do defeito. O mesmo padrão usado no atendimento agora vale aqui.",
      refresh: "Atualizar",
      loading: "Carregando conversa...",
      empty: "Nenhum comentário interno registrado.",
      you: "Você",
      team: "Equipe",
      internalComment: "comentário interno",
      internalCollaborator: "colaborador interno",
      inputPlaceholder: "Escreva uma atualização ou orientação interna para este defeito",
      visibilityNote: "Os comentários ficam visíveis para quem tem acesso ao defeito.",
      characters: "{count}/{max} caracteres",
      sending: "Enviando...",
      publish: "Publicar comentário",
    },
    evidence: {
      attach: "Anexar evidência",
      change: "Trocar evidência",
      remove: "Remover evidência",
      uploadError: "Não foi possível anexar a evidência.",
      oneAttached: "1 evidência",
      manyAttached: "{count} evidências",
    },
    timeline: {
      kicker: "Histórico de mudanças",
      title: "Linha do tempo operacional",
      notice:
        "O Qase não expõe um histórico detalhado de comentários e mudanças nessa API. A linha do tempo mescla os marcos disponíveis do Qase com os eventos internos da plataforma.",
      loading: "Carregando histórico...",
      empty: "Nenhuma mudança registrada.",
      qase: "Qase",
      platform: "Plataforma",
      created: "Defeito criado",
      createdWithNote: "Defeito criado: {note}",
      statusChanged: "Status: {from} -> {to}",
      runLinked: "Run vinculada",
      runLinkedWithValue: "Run vinculada: {value}",
      runRemoved: "Run desvinculada",
      runRemovedWithValue: "Run removida: {value}",
      updated: "Campos do defeito atualizados",
      assigneeRemoved: "Responsável interno removido",
      assigneeWithValue: "Responsável interno: {value}",
      commentAdded: "Comentário interno registrado",
      deleted: "Defeito removido",
      deletedWithNote: "Defeito removido: {note}",
      updatedFallback: "Atualização registrada",
    },
    api: {
      unauthorized: "Não autorizado",
      companyMissing: "Empresa não informada",
      forbidden: "Acesso proibido",
      defectNotFound: "Defeito não encontrado",
      requiredComment: "Comentário obrigatório",
      saveCommentFailed: "Não foi possível salvar o comentário",
      nameRequired: "Nome obrigatório",
      invalidJson: "JSON inválido",
      notFound: "Não encontrado",
      invalidResponsible: "Responsável inválido",
      responsibleMustBelongCompany: "Responsável precisa estar vinculado à empresa.",
      qualityGateBlocked: "Quality gate bloqueado",
      noAssignPermission: "Sem permissão para atribuir responsável",
      integratedAssignOnly: "A atribuição local só é usada para defeitos integrados",
      saveAssigneeFailed: "Não foi possível salvar o responsável",
      forbiddenEn: "Forbidden",
    },
    fallbackErrors: {
      network: "Não foi possível conectar a API.",
      loadHistory: "Não foi possível carregar o histórico do defeito.",
      loadDefects: "Não foi possível carregar os defeitos da empresa.",
      createManual: "Não foi possível criar o defeito manual.",
      saveManual: "Não foi possível salvar o defeito manual.",
      saveInternalAssignee: "Não foi possível salvar o responsável interno.",
      removeManual: "Não foi possível remover o defeito manual.",
      publishComment: "Não foi possível publicar o comentário.",
    },
  },
  "en-US": {
    common: {
      company: "Company",
      emptyValue: "--",
      system: "System",
      integration: "Integration",
    },
    hero: {
      kicker: "{company} panel",
      title: "Defects",
      subtitle: "Unified base for triage, review, and follow-up of the defects visible in the current scope.",
      qaseConnected: "Qase connected",
      integrationStatus: "Integration status: {value}",
      newDefect: "New defect",
    },
    metrics: {
      openTitle: "Open defects",
      openDescription: "Items outside the done state in the current slice.",
      qaseTitle: "Qase integrated",
      qaseDescription: "Total fetched from the Qase integration.",
      manualTitle: "Manual",
      manualDescription: "Internal items created in the platform.",
      mttrTitle: "Average MTTR",
      mttrDescription: "Average resolution time for completed items.",
    },
    source: {
      manual: "Manual",
      qase: "Qase",
      mixed: "Mixed",
      qaseSuffix: " - Qase",
      mixedSuffix: " - Mixed",
      filterAll: "Source: all",
      chipQase: "Qase source",
      chipManual: "Manual source",
      label: "Source",
    },
    status: {
      open: "Open",
      inProgress: "In progress",
      done: "Done",
      label: "Status",
      filterAll: "Status: all",
      prefix: "Status: {value}",
    },
    severity: {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
      none: "No severity",
      label: "Severity",
      prefix: "Severity: {value}",
    },
    priority: {
      high: "High",
      medium: "Medium",
      low: "Low",
      none: "No priority",
      label: "Priority",
      prefix: "Priority: {value}",
    },
    blocked: {
      badge: "Qase projects unavailable",
      title: "Some projects could not be queried right now",
      description:
        "These projects were removed from filters, manual linking, and the application catalog until the integration responds safely again.",
      blockedProjects: "Blocked projects",
      blockedProjectsDescription: "They stay out of selectors until access is normalized.",
      unauthorized: "Unauthorized",
      unauthorizedDescription: "The token does not have enough permission to read this project in Qase.",
      technicalFailure: "Technical failure",
      technicalFailureDescription: "Invalid project, wrong route, or integration error returned by the API.",
      unauthorizedPill: "Unauthorized",
      integrationFailurePill: "Integration failure",
      whyUnavailable: "Why it is unavailable",
      returnedDetail: "Returned detail",
      howToFix: "How to fix it",
      noTechnicalDetail: "No technical detail was returned by the integration.",
      unauthorizedReason: "There is no permission to query defects from this project in Qase.",
      genericReason: "The integration could not query this project in Qase.",
      unauthorizedAction: "Review the saved token and confirm it has read access to this project inside Qase.",
      duplicatedBaseUrlAction:
        "The integration base URL is duplicating /v1. Fix the company configuration to use only the Qase API base domain.",
      notFoundAction: "Validate whether the project code is correct in the company settings and whether it really exists in the Qase workspace.",
      genericAction: "Validate the project configuration and integration connectivity before enabling this item again in the platform.",
    },
    filters: {
      kicker: "Operational filters",
      title: "Panel controls",
      subtitle: "Adjust the scope by source, application, status, and owner.",
      clear: "Clear filters",
      searchPlaceholder: "Search by title, description, run...",
      searchAria: "Search defects",
      applicationAll: "Application: all",
      startDateAria: "Filter defects by creation start date",
      endDateAria: "Filter defects by creation end date",
      projectAll: "Project: all",
      responsibleAll: "Owner: all",
      responsibleAria: "Filter defects by owner",
      applicationAria: "Filter defects by application",
      projectAria: "Filter defects by project",
      sourceAria: "Filter defects by source",
      statusAria: "Filter defects by status",
      unassigned: "Unassigned",
      chipRun: "Run {value}",
      chipApplication: "Application {value}",
      chipDateFrom: "From {value}",
      chipDateTo: "To {value}",
      chipDateRange: "Period {from} - {to}",
      chipProject: "Project {value}",
      chipStatus: "Status {value}",
      chipResponsible: "Owner {value}",
      chipSearch: 'Search "{value}"',
    },
    list: {
      kicker: "Operational base",
      title: "Visible defects",
      subtitle: "Cards with quick reading, details, comments, and ownership.",
      cardsCount: "{count} cards",
      reload: "Reload data",
      loading: "Loading defects...",
      emptyTitle: "No defects found.",
      emptyDescription:
        "Reload integration data, review the company linked base, or create a manual defect to start the panel.",
      filteredEmptyTitle: "No defects found for the current filters.",
      filteredEmptyDescription: "Review the applied filters or reload the data to refresh the displayed base.",
      createManual: "Create manual defect",
      viewDetails: "View details",
      openInQase: "Open in Qase",
      commentsCount: "{count} comment(s)",
      application: "Application",
      project: "Project",
      responsible: "Owner",
      severity: "Severity",
      priority: "Priority",
      notDefined: "Not defined",
      createdAt: "Created at",
      run: "Run",
      createdBy: "Created by",
      lastComment: "Last comment",
      mttr: "MTTR",
    },
    create: {
      kicker: "New manual defect",
      title: "Register defect",
      subtitle: "Create an internal defect without taking focus away from the operational base.",
      closeAria: "Close defect creation",
      closeTitle: "Close",
      titlePlaceholder: "Defect title",
      selectApplication: "Select application",
      otherApplication: "Other application",
      customApplicationPlaceholder: "Application",
      selectProject: "Project / Qase code",
      customProjectPlaceholder: "Project / Qase code",
      selectApplicationAria: "Select defect application",
      selectProjectAria: "Select defect Qase project",
      selectStatusAria: "Select manual defect status",
      selectSeverityAria: "Select manual defect severity",
      selectPriorityAria: "Select manual defect priority",
      runSelectAria: "Select linked run for the manual defect",
      runSearchPlaceholder: "Search application run",
      runEmpty: "No runs found for the selected application.",
      runClear: "No linked run",
      descriptionPlaceholder: "Defect description",
      environmentsPlaceholder: "Environments (comma-separated)",
      cancel: "Cancel",
      creating: "Creating...",
      submit: "Create defect",
      manualApplicationFallback: "Manual application",
    },
    detail: {
      kicker: "Defects",
      summary: "Executive summary",
      manualDescription: "Manual defect with operational editing, internal comments, and full tracking.",
      qaseDescription: "Qase-synced defect with internal collaboration and local ownership.",
      closeAria: "Close defect details",
      closeTitle: "Close",
      openOriginal: "Open original item in Qase",
      operationalFields: "Operational fields",
      titlePlaceholder: "Title",
      descriptionPlaceholder: "Description",
      applicationPlaceholder: "Application",
      projectPlaceholder: "Project / Qase code",
      runPlaceholder: "Linked run",
      environmentsPlaceholder: "Environments",
      statusAria: "Defect status",
      severityAria: "Defect severity",
      priorityAria: "Defect priority",
      responsibleAria: "Defect owner",
      runSelectAria: "Select linked run",
      runSearchPlaceholder: "Search application run",
      runEmpty: "No runs found for the selected application.",
      runClear: "No linked run",
      remove: "Remove defect",
      saveChanges: "Save changes",
      saveAssignee: "Save internal owner",
    },
    comments: {
      title: "Internal comments",
      subtitle: "Operational conversation for the defect. The same support pattern now applies here.",
      refresh: "Refresh",
      loading: "Loading conversation...",
      empty: "No internal comment recorded.",
      you: "You",
      team: "Team",
      internalComment: "internal comment",
      internalCollaborator: "internal collaborator",
      inputPlaceholder: "Write an update or internal guidance for this defect",
      visibilityNote: "Comments stay visible to anyone who has access to the defect.",
      characters: "{count}/{max} characters",
      sending: "Sending...",
      publish: "Publish comment",
    },
    evidence: {
      attach: "Attach evidence",
      change: "Replace evidence",
      remove: "Remove evidence",
      uploadError: "Could not attach the evidence.",
      oneAttached: "1 evidence",
      manyAttached: "{count} evidence files",
    },
    timeline: {
      kicker: "Change history",
      title: "Operational timeline",
      notice:
        "Qase does not expose a detailed history of comments and changes in this API. The timeline merges the available Qase milestones with the platform internal events.",
      loading: "Loading history...",
      empty: "No changes recorded.",
      qase: "Qase",
      platform: "Platform",
      created: "Defect created",
      createdWithNote: "Defect created: {note}",
      statusChanged: "Status: {from} -> {to}",
      runLinked: "Run linked",
      runLinkedWithValue: "Run linked: {value}",
      runRemoved: "Run unlinked",
      runRemovedWithValue: "Run removed: {value}",
      updated: "Defect fields updated",
      assigneeRemoved: "Internal owner removed",
      assigneeWithValue: "Internal owner: {value}",
      commentAdded: "Internal comment recorded",
      deleted: "Defect removed",
      deletedWithNote: "Defect removed: {note}",
      updatedFallback: "Update recorded",
    },
    api: {
      unauthorized: "Not authorized",
      companyMissing: "Company not informed",
      forbidden: "Access denied",
      defectNotFound: "Defect not found",
      requiredComment: "Comment is required",
      saveCommentFailed: "Could not save the comment",
      nameRequired: "Name is required",
      invalidJson: "Invalid JSON",
      notFound: "Not found",
      invalidResponsible: "Invalid owner",
      responsibleMustBelongCompany: "The owner must belong to the company.",
      qualityGateBlocked: "Quality gate blocked",
      noAssignPermission: "No permission to assign an owner",
      integratedAssignOnly: "Local assignment is only used for integrated defects",
      saveAssigneeFailed: "Could not save the owner",
      forbiddenEn: "Forbidden",
    },
    fallbackErrors: {
      network: "Could not reach the API.",
      loadHistory: "Could not load the defect history.",
      loadDefects: "Could not load company defects.",
      createManual: "Could not create the manual defect.",
      saveManual: "Could not save the manual defect.",
      saveInternalAssignee: "Could not save the internal owner.",
      removeManual: "Could not remove the manual defect.",
      publishComment: "Could not publish the comment.",
    },
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

type DefectsCopy = (typeof DEFECTS_COPY)[keyof typeof DEFECTS_COPY];

function interpolate(template: string, params: Record<string, string | number>) {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeProjectCode(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized || "";
}

function normalizeProjectKey(value: string | null | undefined) {
  return normalizeProjectCode(value).toUpperCase();
}

function hasDuplicatedApplicationAndProject(applicationName: string | null | undefined, projectCode: string | null | undefined) {
  const normalizedApplication = normalizeText(applicationName);
  const normalizedProject = normalizeText(projectCode);
  return Boolean(normalizedApplication) && normalizedApplication === normalizedProject;
}

function normalizeNumericId(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized || null;
}

function normalizeDefectSeverity(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized === "critica" || normalized === "critico" || normalized === "critical") return "critical";
  if (normalized === "alta" || normalized === "high") return "high";
  if (normalized === "media" || normalized === "medium") return "medium";
  if (normalized === "baixa" || normalized === "low") return "low";
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDefectPriority(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized === "alta" || normalized === "high") return "high";
  if (normalized === "media" || normalized === "medium") return "medium";
  if (normalized === "baixa" || normalized === "low") return "low";
  return typeof value === "string" ? value.trim() : "";
}

function humanizeLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sanitizeEvidenceFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
}

function buildEvidenceMarkdown(name: string, url: string) {
  return `[Evidencia: ${name}](${url})`;
}

function isDefectEvidenceLabel(label: string) {
  return /^evid[eê]ncia:/i.test(label.trim());
}

function getDefectEvidenceDisplayLabel(label: string) {
  return label.replace(/^evid[eê]ncia:\s*/i, "").trim() || label.trim();
}

function parseDefectDescription(body?: string | null): { text: string; evidence: DefectEvidenceLink[] } {
  const source = body ?? "";
  if (!source.trim()) {
    return { text: "", evidence: [] };
  }

  const evidence: DefectEvidenceLink[] = [];
  const text = source
    .replace(DEFECT_EVIDENCE_PATTERN, (raw, label, href) => {
      if (!isDefectEvidenceLabel(label)) return raw;
      evidence.push({ raw, label, href });
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, evidence };
}

function renderDefectRichText(body: string) {
  const lines = body.split("\n");
  return lines.map((line, lineIndex) => {
    const matches = Array.from(line.matchAll(DEFECT_EVIDENCE_PATTERN));
    if (matches.length === 0) {
      return (
        <Fragment key={`line-${lineIndex}`}>
          {line}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </Fragment>
      );
    }

    const parts: ReactNode[] = [];
    let cursor = 0;
    matches.forEach((match, matchIndex) => {
      const [raw, label, href] = match;
      const start = match.index ?? 0;
      if (start > cursor) {
        parts.push(<span key={`text-${lineIndex}-${matchIndex}`}>{line.slice(cursor, start)}</span>);
      }
      parts.push(
        <a
          key={`link-${lineIndex}-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-600 underline underline-offset-2 hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
        >
          {isDefectEvidenceLabel(label) ? getDefectEvidenceDisplayLabel(label) : label}
        </a>,
      );
      cursor = start + raw.length;
    });
    if (cursor < line.length) {
      parts.push(<span key={`tail-${lineIndex}`}>{line.slice(cursor)}</span>);
    }

    return (
      <Fragment key={`line-${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </Fragment>
    );
  });
}

function buildDraftFromDefect(defect: CompanyDefect): DefectFormState {
  const parsedDescription = parseDefectDescription(defect.description);
  return {
    title: defect.title || defect.name || "",
    description: parsedDescription.text,
    applicationName: defect.applicationName ?? "",
    projectCode: defect.projectCode ?? "",
    status: normalizeDefectStatus(defect.status),
    severity: normalizeDefectSeverity(defect.severity),
    priority: normalizeDefectPriority(defect.priority),
    assignedToUserId: defect.assignedToUserId ?? "",
    runSlug: defect.runSlug ?? "",
    environments: Array.isArray(defect.environments) ? defect.environments.join(", ") : "",
  };
}

function buildEmptyCreateDraft(): DefectFormState {
  return {
    title: "",
    description: "",
    applicationName: "",
    projectCode: "",
    status: "open",
    severity: "medium",
    priority: "medium",
    assignedToUserId: "",
    runSlug: "",
    environments: "",
  };
}

function buildRunCatalog(
  manualRuns: ManualRunRecord[],
  integratedRuns: IntegratedRunRecord[],
  collator: Intl.Collator,
): RunCatalogOption[] {
  const catalog = new Map<string, RunCatalogOption>();

  const register = (
    source: RunCatalogOption["source"],
    slugValue: string | null | undefined,
    nameValue: string | null | undefined,
    applicationValue: string | null | undefined,
    projectValue: string | null | undefined,
    createdAtValue: string | null | undefined,
  ) => {
    const slug = normalizeOptionalString(slugValue);
    const name = normalizeOptionalString(nameValue);
    if (!slug || !name) return;
    catalog.set(slug, {
      slug,
      name,
      createdAt: normalizeOptionalString(createdAtValue),
      applicationName: normalizeOptionalString(applicationValue),
      projectCode: normalizeOptionalString(projectValue),
      source,
    });
  };

  manualRuns.forEach((run) => {
    register("manual", run.slug, run.name, run.app, run.qaseProject ?? run.app, run.createdAt);
  });
  integratedRuns.forEach((run) => {
    register("qase", run.slug, run.title ?? run.name, run.app ?? run.project, run.qaseProject ?? run.project ?? run.app, run.createdAt);
  });

  return Array.from(catalog.values()).sort((left, right) => {
    const timeDiff = (Date.parse(right.createdAt ?? "") || 0) - (Date.parse(left.createdAt ?? "") || 0);
    if (timeDiff !== 0) return timeDiff;
    return collator.compare(left.name, right.name);
  });
}

function filterRunCatalog(options: RunCatalogOption[], applicationName: string, projectCode: string) {
  const normalizedApplication = normalizeText(applicationName);
  const normalizedProject = normalizeProjectKey(projectCode);
  return options.filter((option) => {
    const matchesApplication = normalizedApplication
      ? normalizeText(option.applicationName) === normalizedApplication
      : false;
    const matchesProject = normalizedProject
      ? normalizeProjectKey(option.projectCode) === normalizedProject
      : false;
    if (normalizedApplication && normalizedProject) return matchesApplication || matchesProject;
    if (normalizedApplication) return matchesApplication;
    if (normalizedProject) return matchesProject;
    return true;
  });
}

function getRunOptionDisplay(option: RunCatalogOption | null | undefined) {
  if (!option) return "";
  return option.name || option.slug;
}

type RunSelectorFieldProps = {
  value: string;
  options: RunCatalogOption[];
  selectedOption: RunCatalogOption | null;
  disabled?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  clearLabel: string;
  ariaLabel: string;
  onSelect: (nextSlug: string) => void;
};

function RunSelectorField({
  value,
  options,
  selectedOption,
  disabled = false,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  ariaLabel,
  onSelect,
}: RunSelectorFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const visibleOptions = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    if (!normalizedSearch) return options;
    return options.filter((option) =>
      [option.name, option.slug, option.applicationName, option.projectCode]
        .filter(Boolean)
        .some((entry) => normalizeText(entry).includes(normalizedSearch)),
    );
  }, [options, search]);

  const triggerLabel = selectedOption ? getRunOptionDisplay(selectedOption) : value || placeholder;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setSearch("");
        }}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-left text-sm text-(--tc-text-primary,#0b1a3c) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
      >
        <span className={`truncate ${selectedOption || value ? "" : "text-(--tc-text-muted,#64748b)"}`}>{triggerLabel}</span>
        <FiChevronDown className={`shrink-0 transition ${open ? "rotate-180" : ""}`} size={16} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-3 shadow-[0_18px_40px_rgba(15,23,42,0.24)]">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted,#64748b)" size={15} />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) py-2.5 pl-10 pr-4 text-sm text-(--tc-text-primary,#0b1a3c) placeholder:text-(--tc-text-muted,#64748b)"
            />
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onSelect("");
                setOpen(false);
                setSearch("");
              }}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm text-(--tc-text-primary,#0b1a3c) transition hover:bg-(--tc-surface-2,#f8fafc)"
            >
              <span>{clearLabel}</span>
              {!value ? <span className="text-xs text-(--tc-text-muted,#64748b)">✓</span> : null}
            </button>

            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const selected = option.slug === value;
                return (
                  <button
                    key={option.slug}
                    type="button"
                    role="option"
                    aria-selected={selected ? "true" : "false"}
                    onClick={() => {
                      onSelect(option.slug);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`mt-1 flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2 text-left transition ${
                      selected ? "bg-(--tc-surface-2,#f8fafc)" : "hover:bg-(--tc-surface-2,#f8fafc)"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{option.name}</p>
                      <p className="truncate text-xs text-(--tc-text-muted,#64748b)">
                        {option.slug}
                        {option.projectCode ? ` · ${option.projectCode}` : ""}
                      </p>
                    </div>
                    {selected ? <span className="text-xs font-semibold text-sky-600">✓</span> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-4 text-sm text-(--tc-text-muted,#64748b)">{emptyLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDefectStatus(value: string | null | undefined, copy: DefectsCopy) {
  const normalized = normalizeDefectStatus(value ?? "");
  if (normalized === "done") return copy.status.done;
  if (normalized === "in_progress") return copy.status.inProgress;
  return copy.status.open;
}

function formatDefectSeverity(value: string | number | null | undefined, copy: DefectsCopy) {
  if (value == null || value === "") return copy.common.emptyValue;
  if (typeof value === "number") return String(value);
  const normalized = normalizeDefectSeverity(value);
  if (normalized === "critical") return copy.severity.critical;
  if (normalized === "high") return copy.severity.high;
  if (normalized === "medium") return copy.severity.medium;
  if (normalized === "low") return copy.severity.low;
  return humanizeLabel(value);
}

function formatDefectPriority(value: string | null | undefined, copy: DefectsCopy) {
  if (!value) return copy.common.emptyValue;
  const normalized = normalizeDefectPriority(value);
  if (normalized === "high") return copy.priority.high;
  if (normalized === "medium") return copy.priority.medium;
  if (normalized === "low") return copy.priority.low;
  return humanizeLabel(value);
}

function formatDateTime(value: string | null | undefined, locale: Locale, emptyValue: string) {
  if (!value) return emptyValue;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return emptyValue;
  return new Date(timestamp).toLocaleString(locale);
}

function formatDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateFilterChip(value: string, locale: Locale) {
  if (!value) return value;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale);
}

function isCreatedAtWithinRange(value: string | null | undefined, startDate: string, endDate: string) {
  const createdDate = formatDateInputValue(value);
  if (!createdDate) return false;
  if (startDate && createdDate < startDate) return false;
  if (endDate && createdDate > endDate) return false;
  return true;
}

function sortDefectComments(items: DefectComment[]) {
  return [...items].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function getDefectCommentInitials(comment: DefectComment, mine: boolean, copy: DefectsCopy) {
  const source = comment.authorName || (mine ? copy.comments.you : copy.comments.team);
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function formatRelativeOrigin(sourceType: CompanyDefect["sourceType"], copy: DefectsCopy) {
  return sourceType === "manual" ? copy.source.manual : copy.source.qase;
}

function formatBlockedQaseReason(project: BlockedQaseProject, copy: DefectsCopy) {
  if (project.reason === "unauthorized") {
    return copy.blocked.unauthorizedReason;
  }
  return copy.blocked.genericReason;
}

function formatBlockedQaseDetail(project: BlockedQaseProject, copy: DefectsCopy) {
  if (!project.message) return copy.blocked.noTechnicalDetail;
  return project.message;
}

function formatBlockedQaseAction(project: BlockedQaseProject, copy: DefectsCopy) {
  const detail = (project.message ?? "").toLowerCase();

  if (project.reason === "unauthorized") {
    return copy.blocked.unauthorizedAction;
  }

  if (detail.includes("/v1/v1/defect")) {
    return copy.blocked.duplicatedBaseUrlAction;
  }

  if (detail.includes("not found")) {
    return copy.blocked.notFoundAction;
  }

  return copy.blocked.genericAction;
}

function getDefectMttrHours(defect: CompanyDefect) {
  const status = normalizeDefectStatus(defect.status);
  const openedAt = resolveOpenedAt(defect.createdAt);
  const closedAt = resolveClosedAt(status, defect.closedAt ?? null, defect.updatedAt ?? null);
  const mttrMs = calcMTTR(openedAt, closedAt);
  return mttrMs != null ? Math.round(mttrMs / 360000) / 10 : null;
}

function parseAssigneeNote(note?: string | null) {
  if (!note) return { userId: null as string | null, userName: null as string | null };
  try {
    const parsed = JSON.parse(note) as { userId?: unknown; userName?: unknown };
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
      userName: typeof parsed.userName === "string" ? parsed.userName : null,
    };
  } catch {
    return { userId: null, userName: note };
  }
}

function formatHistoryLabel(event: DefectHistoryEvent, copy: DefectsCopy) {
  switch (event.action) {
    case "created":
      return event.note ? interpolate(copy.timeline.createdWithNote, { note: event.note }) : copy.timeline.created;
    case "status_changed":
      return interpolate(copy.timeline.statusChanged, {
        from: formatDefectStatus(event.fromStatus, copy),
        to: formatDefectStatus(event.toStatus, copy),
      });
    case "run_linked":
      return event.toRunSlug ? interpolate(copy.timeline.runLinkedWithValue, { value: event.toRunSlug }) : copy.timeline.runLinked;
    case "run_unlinked":
      return event.fromRunSlug ? interpolate(copy.timeline.runRemovedWithValue, { value: event.fromRunSlug }) : copy.timeline.runRemoved;
    case "updated":
      return event.note ?? copy.timeline.updated;
    case "assignee_changed": {
      const assignee = parseAssigneeNote(event.note);
      return assignee.userName
        ? interpolate(copy.timeline.assigneeWithValue, { value: assignee.userName })
        : copy.timeline.assigneeRemoved;
    }
    case "comment_added":
      return copy.timeline.commentAdded;
    case "deleted":
      return event.note ? interpolate(copy.timeline.deletedWithNote, { note: event.note }) : copy.timeline.deleted;
    default:
      return event.note ?? copy.timeline.updatedFallback;
  }
}

function sortDefects(items: CompanyDefect[]) {
  return [...items].sort((left, right) => {
    const leftTime = Math.max(Date.parse(left.updatedAt ?? "") || 0, Date.parse(left.createdAt ?? "") || 0);
    const rightTime = Math.max(Date.parse(right.updatedAt ?? "") || 0, Date.parse(right.createdAt ?? "") || 0);
    return rightTime - leftTime;
  });
}

function buildCompanyDefectFromManualPayload(
  payload: ManualDefectMutationResponse,
  options: {
    fallback?: CompanyDefect | null;
    canEdit: boolean;
    canDelete: boolean;
    canAssign: boolean;
    canComment: boolean;
  },
): CompanyDefect | null {
  const slug = normalizeOptionalString(payload.slug) ?? options.fallback?.slug ?? null;
  const name = normalizeOptionalString(payload.name) ?? options.fallback?.name ?? options.fallback?.title ?? null;
  if (!slug || !name) return null;

  const projectCode = normalizeProjectCode(payload.qaseProject ?? payload.app) || options.fallback?.projectCode || null;
  const applicationName =
    normalizeOptionalString(payload.app) ??
    normalizeProjectCode(payload.qaseProject ?? payload.app) ??
    options.fallback?.applicationName ??
    null;

  return {
    id: normalizeOptionalString(payload.id) ?? slug,
    slug,
    title: name,
    name,
    status: normalizeOptionalString(payload.status) ?? options.fallback?.status ?? "open",
    createdAt: normalizeOptionalString(payload.createdAt) ?? options.fallback?.createdAt ?? null,
    updatedAt: normalizeOptionalString(payload.updatedAt) ?? options.fallback?.updatedAt ?? null,
    closedAt: normalizeOptionalString(payload.closedAt) ?? options.fallback?.closedAt ?? null,
    runSlug: normalizeOptionalString(payload.runSlug) ?? options.fallback?.runSlug ?? null,
    runName: normalizeOptionalString(payload.runName) ?? options.fallback?.runName ?? null,
    runId: normalizeNumericId(payload.runId) ?? options.fallback?.runId ?? null,
    sourceType: "manual",
    projectCode,
    applicationName,
    description: normalizeOptionalString(payload.observations) ?? options.fallback?.description ?? null,
    severity: payload.severity ?? options.fallback?.severity ?? null,
    priority: normalizeOptionalString(payload.priority) ?? options.fallback?.priority ?? null,
    externalUrl: options.fallback?.externalUrl ?? null,
    createdByUserId: normalizeOptionalString(payload.createdByUserId) ?? options.fallback?.createdByUserId ?? null,
    createdByName: normalizeOptionalString(payload.createdByName) ?? options.fallback?.createdByName ?? null,
    assignedToUserId: normalizeOptionalString(payload.assignedToUserId) ?? options.fallback?.assignedToUserId ?? null,
    assignedToName: normalizeOptionalString(payload.assignedToName) ?? options.fallback?.assignedToName ?? null,
    environments: Array.isArray(payload.environments)
      ? payload.environments.map((item) => item.trim()).filter(Boolean)
      : options.fallback?.environments ?? [],
    commentsCount: options.fallback?.commentsCount ?? 0,
    lastCommentAt: options.fallback?.lastCommentAt ?? null,
    canEdit: options.canEdit,
    canDelete: options.canDelete,
    canAssign: options.canAssign,
    canComment: options.canComment,
  };
}

export default function CompanyDefectsPage() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthUser();
  const { language } = useI18n();
  const locale = normalizeLocale(language);
  const copy = useMemo(() => DEFECTS_COPY[locale], [locale]);
  const collator = useMemo(() => new Intl.Collator(locale, { sensitivity: "base" }), [locale]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);

  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const companyLabel = useMemo(() => {
    const preferredName =
      (user as { companyName?: string | null } | null)?.companyName ??
      (user as { clientName?: string | null } | null)?.clientName ??
      null;
    return preferredName?.trim() || humanizeLabel(companySlug ?? copy.common.company);
  }, [companySlug, copy.common.company, user]);

  const localizeApiMessage = useCallback(
    (message?: string | null, fallback?: string) => {
      if (!message) return fallback ?? "";
      if (locale === "pt-BR") return message;
      switch (message) {
        case "Nao autorizado":
          return copy.api.unauthorized;
        case "Empresa nao informada":
          return copy.api.companyMissing;
        case "Acesso proibido":
          return copy.api.forbidden;
        case "Defeito nao encontrado":
          return copy.api.defectNotFound;
        case "Comentario obrigatorio":
          return copy.api.requiredComment;
        case "Nao foi possivel salvar o comentario":
          return copy.api.saveCommentFailed;
        case "Nome obrigatorio":
          return copy.api.nameRequired;
        case "JSON invalido":
          return copy.api.invalidJson;
        case "Nao encontrado":
          return copy.api.notFound;
        case "Responsavel invalido":
          return copy.api.invalidResponsible;
        case "Responsavel precisa estar vinculado a empresa.":
        case "Responsavel precisa estar vinculado a empresa":
          return copy.api.responsibleMustBelongCompany;
        case "Quality gate bloqueado":
          return copy.api.qualityGateBlocked;
        case "Sem permissao para atribuir responsavel":
          return copy.api.noAssignPermission;
        case "Atribuicao local so e usada para defeitos integrados":
          return copy.api.integratedAssignOnly;
        case "Nao foi possivel salvar o responsavel":
          return copy.api.saveAssigneeFailed;
        case "Forbidden":
          return copy.api.forbiddenEn;
        default:
          return fallback ?? message;
      }
    },
    [copy, locale],
  );

  const localizeTimelineNotice = useCallback(
    (message?: string | null) => {
      if (!message) return null;
      if (
        message ===
        "O Qase nao expoe um historico detalhado de comentarios e mudancas nessa API. A linha do tempo mescla os marcos disponiveis do Qase com os eventos internos da plataforma."
      ) {
        return copy.timeline.notice;
      }
      return locale === "pt-BR" ? message : message;
    },
    [copy.timeline.notice, locale],
  );

  const localizeClientError = useCallback(
    (error: unknown, fallback: string) => {
      if (!(error instanceof Error) || !error.message) return fallback;
      if (error.message === "Failed to fetch") return copy.fallbackErrors.network;
      return error.message;
    },
    [copy.fallbackErrors.network],
  );

  const resetFileInput = useCallback((ref: { current: HTMLInputElement | null }) => {
    if (ref.current) {
      ref.current.value = "";
    }
  }, []);

  const uploadEvidence = useCallback(
    async (file: File, scope: string) => {
      const safeName = sanitizeEvidenceFileName(file.name || `evidencia-${Date.now()}`);
      const key = `defects/evidencias/${scope}/${Date.now()}-${safeName}`;
      const form = new FormData();
      form.set("file", file);
      form.set("key", key);

      const response = await fetchApi("/api/s3/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        key?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.key) {
        throw new Error(payload.error || copy.evidence.uploadError);
      }
      return {
        name: file.name,
        url: `/api/s3/object?key=${encodeURIComponent(payload.key)}`,
      };
    },
    [copy.evidence.uploadError],
  );

  const [defects, setDefects] = useState<CompanyDefect[]>([]);
  const [applicationCatalog, setApplicationCatalog] = useState<ApplicationCatalogOption[]>([]);
  const [responsibleOptions, setResponsibleOptions] = useState<ResponsibleOption[]>([]);
  const [runCatalog, setRunCatalog] = useState<RunCatalogOption[]>([]);
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrationWarning, setIntegrationWarning] = useState<string | null>(null);
  const [integrationProviders, setIntegrationProviders] = useState<IntegrationProvider[]>([]);
  const [blockedQaseProjects, setBlockedQaseProjects] = useState<BlockedQaseProject[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<DefectFormState>(buildEmptyCreateDraft);
  const [createEvidenceFile, setCreateEvidenceFile] = useState<File | null>(null);
  const [createApplicationMode, setCreateApplicationMode] = useState<"catalog" | "custom">("catalog");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeDefect, setActiveDefect] = useState<CompanyDefect | null>(null);
  const [editDraft, setEditDraft] = useState<DefectFormState>(buildEmptyCreateDraft);
  const [editEvidenceLinks, setEditEvidenceLinks] = useState<DefectEvidenceLink[]>([]);
  const [editEvidenceFile, setEditEvidenceFile] = useState<File | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailHistory, setDetailHistory] = useState<DefectHistoryEvent[]>([]);
  const [detailComments, setDetailComments] = useState<DefectComment[]>([]);
  const [detailTimelineNotice, setDetailTimelineNotice] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentEvidenceFile, setCommentEvidenceFile] = useState<File | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTimelineError, setDetailTimelineError] = useState<string | null>(null);
  const activityAbortRef = useRef<AbortController | null>(null);
  const activeDefectSlugRef = useRef("");
  const createEvidenceInputRef = useRef<HTMLInputElement | null>(null);
  const editEvidenceInputRef = useRef<HTMLInputElement | null>(null);
  const commentEvidenceInputRef = useRef<HTMLInputElement | null>(null);

  const runFilter = searchParams?.get("run") ?? "";
  const requestedDefectSlug = searchParams?.get("defect") ?? "";

  const updateUrlQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      Object.entries(updates).forEach(([key, value]) => {
        if (value == null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadActivity = useCallback(
    async (defectSlug: string) => {
      if (!companySlug || !defectSlug) return;
      activityAbortRef.current?.abort();
      const controller = new AbortController();
      activityAbortRef.current = controller;
      setDetailLoading(true);
      setDetailTimelineError(null);
      try {
        const response = await fetchApi(
          `/api/company-defects/${encodeURIComponent(defectSlug)}/activity?companySlug=${encodeURIComponent(companySlug)}`,
          { cache: "no-store", credentials: "include", signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const payload = (await response.json().catch(() => ({}))) as ActivityResponse;
        if (!response.ok) {
          if (controller.signal.aborted) return;
          setDetailComments([]);
          setDetailHistory([]);
          setDetailTimelineNotice(null);
          setDetailTimelineError(localizeApiMessage(payload.message, copy.fallbackErrors.loadHistory));
          return;
        }
        setDetailComments(Array.isArray(payload.comments) ? payload.comments : []);
        setDetailHistory(Array.isArray(payload.history) ? payload.history : []);
        setDetailTimelineNotice(localizeTimelineNotice(typeof payload.timelineNotice === "string" ? payload.timelineNotice : null));
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError" || controller.signal.aborted) return;
        const message = localizeClientError(error, copy.fallbackErrors.loadHistory);
        setDetailComments([]);
        setDetailHistory([]);
        setDetailTimelineNotice(null);
        setDetailTimelineError(message);
      } finally {
        if (activityAbortRef.current === controller) {
          activityAbortRef.current = null;
          setDetailLoading(false);
        }
      }
    },
    [companySlug, copy.fallbackErrors.loadHistory, localizeApiMessage, localizeClientError, localizeTimelineNotice],
  );

  useEffect(() => {
    return () => {
      activityAbortRef.current?.abort();
      activityAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeDefectSlugRef.current = activeDefect?.slug ?? "";
  }, [activeDefect?.slug]);

  useEffect(() => {
    const parsedDescription = parseDefectDescription(activeDefect?.description);
    setEditEvidenceLinks(parsedDescription.evidence);
    setEditEvidenceFile(null);
    resetFileInput(editEvidenceInputRef);
  }, [activeDefect?.description, activeDefect?.slug, resetFileInput]);

  const loadOverview = useCallback(
    async (options?: { preserveActiveSlug?: string | null; forceRefresh?: boolean }) => {
      if (!companySlug) return [];
      setLoading(true);
      setPageError(null);
      try {
        const params = new URLSearchParams({ companySlug });
        if (options?.forceRefresh) {
          params.set("refresh", "1");
        }
        const response = await fetchApi(`/api/company-defects?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const payload = (await response.json().catch(() => ({}))) as OverviewResponse;
        if (!response.ok) {
          setDefects([]);
          setApplicationCatalog([]);
          setResponsibleOptions([]);
          setPermissions(EMPTY_PERMISSIONS);
          setIntegrationProviders([]);
          setIntegrationWarning(null);
          setBlockedQaseProjects([]);
          setPageError(localizeApiMessage(payload.message, copy.fallbackErrors.loadDefects));
          return [];
        }

        const nextItems = sortDefects(Array.isArray(payload.items) ? payload.items : []);
        setDefects(nextItems);
        setApplicationCatalog(Array.isArray(payload.applications) ? payload.applications : []);
        setResponsibleOptions(Array.isArray(payload.responsibleOptions) ? payload.responsibleOptions : []);
        setIntegrationProviders(
          Array.isArray(payload.integration?.activeProviders)
            ? payload.integration.activeProviders.filter(
                (provider): provider is IntegrationProvider => provider === "qase" || provider === "jira",
              )
            : [
                ...(payload.integration?.hasQaseToken ? (["qase"] as const) : []),
                ...(payload.integration?.hasJiraToken ? (["jira"] as const) : []),
              ],
        );
        setBlockedQaseProjects(
          Array.isArray(payload.integration?.blockedProjects)
            ? payload.integration.blockedProjects
                .map((project) => {
                  const projectCode = normalizeProjectCode(project?.projectCode);
                  if (!projectCode || project?.accessible === true) return null;
                  return {
                    projectCode,
                    reason: project?.reason === "unauthorized" ? "unauthorized" : "error",
                    message: typeof project?.message === "string" ? project.message : null,
                    defectsCount: typeof project?.defectsCount === "number" ? project.defectsCount : 0,
                  } satisfies BlockedQaseProject;
                })
                .filter((project): project is BlockedQaseProject => Boolean(project))
            : [],
        );
        setPermissions({
          canCreate: Boolean(payload.permissions?.canCreate),
          canEditManual: Boolean(payload.permissions?.canEditManual),
          canDeleteManual: Boolean(payload.permissions?.canDeleteManual),
          canAssignIntegrated: Boolean(payload.permissions?.canAssignIntegrated),
          canComment: payload.permissions?.canComment !== false,
        });
        setIntegrationWarning(payload.warning ?? null);

        if (options?.preserveActiveSlug) {
          const nextActive = nextItems.find((item) => item.slug === options.preserveActiveSlug) ?? null;
          setActiveDefect(nextActive);
          if (nextActive) {
            setEditDraft(buildDraftFromDefect(nextActive));
          }
        }

        return nextItems;
      } catch (error) {
        const message = localizeClientError(error, copy.fallbackErrors.loadDefects);
        setDefects([]);
        setApplicationCatalog([]);
        setResponsibleOptions([]);
        setPermissions(EMPTY_PERMISSIONS);
        setIntegrationProviders([]);
        setIntegrationWarning(null);
        setBlockedQaseProjects([]);
        setPageError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [companySlug, copy.fallbackErrors.loadDefects, localizeApiMessage, localizeClientError],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const currentCompanySlug = companySlug ?? "";
    if (!currentCompanySlug) {
      setRunCatalog([]);
      return;
    }

    let active = true;

    async function loadRunCatalog() {
      try {
        const [manualResponse, integratedResponse] = await Promise.all([
          fetchApi(`/api/releases-manual?clientSlug=${encodeURIComponent(currentCompanySlug)}&kind=run`, {
            cache: "no-store",
            credentials: "include",
          }),
          fetchApi(`/api/v1/runs?all=true&limit=${encodeURIComponent(String(200))}&companySlug=${encodeURIComponent(currentCompanySlug)}`, {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const manualPayload = (await manualResponse.json().catch(() => [])) as unknown;
        const integratedPayload = (await integratedResponse.json().catch(() => ({}))) as {
          data?: unknown[];
          releases?: unknown[];
          result?: { entities?: unknown[] };
        };

        if (!active) return;

        const manualRuns = Array.isArray(manualPayload)
          ? (manualPayload.filter((item) => {
              const record = item as ManualRunRecord;
              return (record.kind ?? "run") === "run";
            }) as ManualRunRecord[])
          : [];
        const integratedRuns = Array.isArray(integratedPayload?.data)
          ? (integratedPayload.data as IntegratedRunRecord[])
          : Array.isArray(integratedPayload?.releases)
            ? (integratedPayload.releases as IntegratedRunRecord[])
            : Array.isArray(integratedPayload?.result?.entities)
              ? (integratedPayload.result.entities as IntegratedRunRecord[])
              : [];

        setRunCatalog(buildRunCatalog(manualRuns, integratedRuns, collator));
      } catch {
        if (!active) return;
        setRunCatalog([]);
      }
    }

    void loadRunCatalog();

    return () => {
      active = false;
    };
  }, [collator, companySlug]);

  const upsertDefectLocally = useCallback(
    (nextDefect: CompanyDefect) => {
      setDefects((current) => sortDefects([nextDefect, ...current.filter((item) => item.slug !== nextDefect.slug)]));
      if (activeDefect?.slug === nextDefect.slug) {
        setActiveDefect(nextDefect);
        setEditDraft(buildDraftFromDefect(nextDefect));
      }
    },
    [activeDefect?.slug],
  );

  const openDefect = useCallback(
    (defect: CompanyDefect) => {
      setActiveDefect(defect);
      setEditDraft(buildDraftFromDefect(defect));
      setCommentBody("");
      setCommentEvidenceFile(null);
      resetFileInput(commentEvidenceInputRef);
      setDetailError(null);
      setDetailTimelineError(null);
      setDetailComments([]);
      setDetailHistory([]);
      setDetailTimelineNotice(null);
      updateUrlQuery({ defect: defect.slug });
      void loadActivity(defect.slug);
    },
    [loadActivity, resetFileInput, updateUrlQuery],
  );

  useEffect(() => {
    if (!requestedDefectSlug || defects.length === 0 || activeDefectSlugRef.current === requestedDefectSlug) return;
    const requested = defects.find((item) => item.slug === requestedDefectSlug);
    if (requested) {
      void openDefect(requested);
    }
  }, [defects, openDefect, requestedDefectSlug]);

  const filteredDefects = useMemo(() => {
    return defects.filter((defect) => {
      if (runFilter && defect.runSlug !== runFilter) return false;
      if (filters.source !== "all" && defect.sourceType !== filters.source) return false;
      if ((filters.startDate || filters.endDate) && !isCreatedAtWithinRange(defect.createdAt, filters.startDate, filters.endDate)) return false;
      if (filters.status !== "all" && normalizeDefectStatus(defect.status) !== filters.status) return false;
      if (filters.application && normalizeProjectKey(defect.applicationName) !== normalizeProjectKey(filters.application)) return false;
      if (filters.responsible) {
        if (filters.responsible === "__unassigned__") {
          if (defect.assignedToUserId || defect.assignedToName) return false;
        } else if (defect.assignedToUserId !== filters.responsible) {
          return false;
        }
      }
      const haystack = [
        defect.title,
        defect.name,
        defect.description,
        defect.applicationName,
        defect.projectCode,
        defect.runName,
        defect.runSlug,
        defect.assignedToName,
        defect.createdByName,
      ]
        .filter(Boolean)
        .join(" ");
      if (filters.search && !normalizeText(haystack).includes(normalizeText(filters.search))) return false;
      return true;
    });
  }, [defects, filters, runFilter]);

  const metrics = useMemo(() => {
    const closed = filteredDefects.filter((item) => normalizeDefectStatus(item.status) === "done");
    const mttrHours = closed
      .map((item) => getDefectMttrHours(item))
      .filter((value): value is number => value != null);
    return {
      open: filteredDefects.filter((item) => normalizeDefectStatus(item.status) !== "done").length,
      manual: filteredDefects.filter((item) => item.sourceType === "manual").length,
      qase: defects.filter((item) => item.sourceType === "qase").length,
      mttr: mttrHours.length ? Math.round((mttrHours.reduce((sum, value) => sum + value, 0) / mttrHours.length) * 10) / 10 : null,
    };
  }, [defects, filteredDefects]);

  const runFilterLabel = useMemo(() => {
    if (!runFilter) return "";
    const match = defects.find((item) => item.runSlug === runFilter);
    return match?.runName ?? runFilter;
  }, [defects, runFilter]);

  const catalogApplications = useMemo(() => {
    const catalog = new Map<string, ApplicationCatalogOption>();

    const register = (nameValue: string | null | undefined, projectValue: string | null | undefined, source: ApplicationCatalogOption["source"]) => {
      const name = normalizeOptionalString(nameValue) ?? normalizeProjectCode(projectValue) ?? null;
      if (!name) return;
      const projectCode = normalizeProjectCode(projectValue) || null;
      const key = `${normalizeText(name)}:${normalizeProjectKey(projectCode)}`;
      const current = catalog.get(key);
      const nextSource =
        !current || current.source === source
          ? source
          : current.source === "mixed" || source === "mixed"
            ? "mixed"
            : "mixed";

      catalog.set(key, {
        name,
        projectCode,
        source: nextSource,
      });
    };

    applicationCatalog.forEach((item) => register(item.name, item.projectCode, item.source));
    defects.forEach((item) => register(item.applicationName, item.projectCode, item.sourceType));

    return Array.from(catalog.values()).sort((left, right) => collator.compare(left.name, right.name));
  }, [applicationCatalog, collator, defects]);

  const applicationOptions = useMemo(() => {
    return catalogApplications
      .filter((item) => {
        if (filters.source === "all") return true;
        if (item.source === "mixed") return true;
        return item.source === filters.source;
      })
      .map((item) => item.name);
  }, [catalogApplications, filters.source]);

  const createApplicationOptions = useMemo(() => catalogApplications, [catalogApplications]);

  const createProjectOptions = useMemo(() => {
    return Array.from(
      new Set(
        createApplicationOptions
          .map((item) => item.projectCode)
          .filter((value): value is string => Boolean(value && value.trim())),
      ),
    ).sort((left, right) => collator.compare(left, right));
  }, [collator, createApplicationOptions]);

  const selectedCreateApplication = useMemo(() => {
    const normalizedApp = normalizeText(createDraft.applicationName);
    const normalizedProject = normalizeProjectKey(createDraft.projectCode);
    return (
      createApplicationOptions.find((item) => {
        const sameName = normalizeText(item.name) === normalizedApp;
        const sameProject = normalizeProjectKey(item.projectCode) === normalizedProject;
        return sameName && (sameProject || !normalizedProject || !item.projectCode);
      }) ?? null
    );
  }, [createApplicationOptions, createDraft.applicationName, createDraft.projectCode]);
  const editApplicationOptions = useMemo(() => {
    const currentApplicationName = normalizeOptionalString(editDraft.applicationName);
    if (!currentApplicationName) return createApplicationOptions;
    const currentProjectCode = normalizeOptionalString(editDraft.projectCode);
    const alreadyExists = createApplicationOptions.some(
      (item) =>
        normalizeText(item.name) === normalizeText(currentApplicationName) &&
        normalizeProjectKey(item.projectCode) === normalizeProjectKey(currentProjectCode),
    );
    if (alreadyExists) return createApplicationOptions;
    return [...createApplicationOptions, {
      name: currentApplicationName,
      projectCode: currentProjectCode,
      source: activeDefect?.sourceType === "qase" ? "qase" : "manual",
    }].sort((left, right) => collator.compare(left.name, right.name));
  }, [activeDefect?.sourceType, collator, createApplicationOptions, editDraft.applicationName, editDraft.projectCode]);
  const selectedEditApplication = useMemo(() => {
    const normalizedApp = normalizeText(editDraft.applicationName);
    const normalizedProject = normalizeProjectKey(editDraft.projectCode);
    return (
      editApplicationOptions.find((item) => {
        const sameName = normalizeText(item.name) === normalizedApp;
        const sameProject = normalizeProjectKey(item.projectCode) === normalizedProject;
        return sameName && (sameProject || !normalizedProject || !item.projectCode);
      }) ?? null
    );
  }, [editApplicationOptions, editDraft.applicationName, editDraft.projectCode]);
  const createRunOptions = useMemo(
    () => filterRunCatalog(runCatalog, createDraft.applicationName, createDraft.projectCode),
    [createDraft.applicationName, createDraft.projectCode, runCatalog],
  );
  const selectedCreateRun = useMemo(
    () => runCatalog.find((item) => item.slug === createDraft.runSlug) ?? null,
    [createDraft.runSlug, runCatalog],
  );
  const editRunOptions = useMemo(
    () => filterRunCatalog(runCatalog, editDraft.applicationName, editDraft.projectCode),
    [editDraft.applicationName, editDraft.projectCode, runCatalog],
  );
  const selectedEditRun = useMemo(
    () => runCatalog.find((item) => item.slug === editDraft.runSlug) ?? null,
    [editDraft.runSlug, runCatalog],
  );

  useEffect(() => {
    if (filters.application && !applicationOptions.includes(filters.application)) {
      setFilters((current) => ({ ...current, application: "" }));
    }
  }, [applicationOptions, filters.application]);

  useEffect(() => {
    if (!createApplicationOptions.length) {
      setCreateApplicationMode("custom");
    }
  }, [createApplicationOptions.length]);

  useEffect(() => {
    if (!createDraft.runSlug) return;
    if (!selectedCreateRun) return;
    if (createRunOptions.some((option) => option.slug === createDraft.runSlug)) return;
    setCreateDraft((current) => ({ ...current, runSlug: "" }));
  }, [createDraft.runSlug, createRunOptions, selectedCreateRun]);

  useEffect(() => {
    if (!activeDefect || activeDefect.sourceType !== "manual") return;
    if (!editDraft.runSlug) return;
    if (!selectedEditRun) return;
    if (editRunOptions.some((option) => option.slug === editDraft.runSlug)) return;
    setEditDraft((current) => ({ ...current, runSlug: "" }));
  }, [activeDefect, editDraft.runSlug, editRunOptions, selectedEditRun]);

  const filterResponsibleOptions = useMemo(() => {
    const dynamic = defects
      .filter((item) => item.assignedToUserId && item.assignedToName)
      .map((item) => ({ userId: item.assignedToUserId!, label: item.assignedToName!, name: item.assignedToName!, email: null }));
    const unique = new Map<string, ResponsibleOption>();
    [...responsibleOptions, ...dynamic].forEach((item) => {
      if (!unique.has(item.userId)) unique.set(item.userId, item);
    });
    return Array.from(unique.values()).sort((left, right) => collator.compare(left.label, right.label));
  }, [collator, defects, responsibleOptions]);

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (runFilter && runFilterLabel) chips.push(interpolate(copy.filters.chipRun, { value: runFilterLabel }));
    if (filters.source !== "all") chips.push(filters.source === "qase" ? copy.source.chipQase : copy.source.chipManual);
    if (filters.application) chips.push(interpolate(copy.filters.chipApplication, { value: filters.application }));
    if (filters.startDate && filters.endDate) {
      chips.push(
        interpolate(copy.filters.chipDateRange, {
          from: formatDateFilterChip(filters.startDate, locale),
          to: formatDateFilterChip(filters.endDate, locale),
        }),
      );
    } else if (filters.startDate) {
      chips.push(interpolate(copy.filters.chipDateFrom, { value: formatDateFilterChip(filters.startDate, locale) }));
    } else if (filters.endDate) {
      chips.push(interpolate(copy.filters.chipDateTo, { value: formatDateFilterChip(filters.endDate, locale) }));
    }
    if (filters.status !== "all") chips.push(interpolate(copy.filters.chipStatus, { value: formatDefectStatus(filters.status, copy) }));
    if (filters.responsible === "__unassigned__") chips.push(copy.filters.unassigned);
    if (filters.responsible && filters.responsible !== "__unassigned__") {
      const responsibleLabel = filterResponsibleOptions.find((item) => item.userId === filters.responsible)?.label;
      if (responsibleLabel) chips.push(interpolate(copy.filters.chipResponsible, { value: responsibleLabel }));
    }
    if (filters.search.trim()) chips.push(interpolate(copy.filters.chipSearch, { value: filters.search.trim() }));
    return chips;
  }, [copy, filterResponsibleOptions, filters, locale, runFilter, runFilterLabel]);

  const visibleHistory = useMemo(() => detailHistory.filter((item) => item.action !== "comment_added"), [detailHistory]);
  const sortedDetailComments = useMemo(() => sortDefectComments(detailComments), [detailComments]);
  const commentLength = commentBody.length;
  const hideDuplicatedProjectField = useMemo(
    () => hasDuplicatedApplicationAndProject(editDraft.applicationName, editDraft.projectCode),
    [editDraft.applicationName, editDraft.projectCode],
  );
  const liveResponsibleLabel = useMemo(() => {
    if (!activeDefect) return null;
    const selectedResponsibleId = normalizeOptionalString(editDraft.assignedToUserId);
    if (!selectedResponsibleId) return null;
    const matchedResponsible = responsibleOptions.find((option) => option.userId === selectedResponsibleId);
    if (matchedResponsible?.label) return matchedResponsible.label;
    if (activeDefect.assignedToUserId === selectedResponsibleId) return activeDefect.assignedToName;
    return null;
  }, [activeDefect, editDraft.assignedToUserId, responsibleOptions]);
  const detailSummaryValues = useMemo(() => {
    if (!activeDefect) {
      return {
        applicationName: null,
        projectCode: null,
        runValue: null,
        responsibleLabel: null,
        severityValue: null as string | number | null,
        priorityValue: null as string | null,
      };
    }
    const canMirrorEditDraft = activeDefect.sourceType === "manual" && activeDefect.canEdit;
    const canMirrorResponsible =
      (activeDefect.sourceType === "manual" && activeDefect.canEdit) ||
      (activeDefect.sourceType === "qase" && activeDefect.canAssign);

    const liveApplicationName = canMirrorEditDraft
      ? normalizeOptionalString(editDraft.applicationName)
      : activeDefect.applicationName;
    const liveProjectCode = canMirrorEditDraft ? normalizeOptionalString(editDraft.projectCode) : activeDefect.projectCode;
    const liveRunValue = canMirrorEditDraft
      ? getRunOptionDisplay(selectedEditRun) || normalizeOptionalString(editDraft.runSlug) || activeDefect.runName || activeDefect.runSlug
      : activeDefect.runName ?? activeDefect.runSlug;
    const liveResponsible = canMirrorResponsible
      ? liveResponsibleLabel
      : activeDefect.assignedToName;
    const liveSeverity = canMirrorEditDraft
      ? normalizeOptionalString(editDraft.severity) ?? null
      : activeDefect.severity;
    const livePriority = canMirrorEditDraft
      ? normalizeOptionalString(editDraft.priority)
      : activeDefect.priority;

    return {
      applicationName: liveApplicationName,
      projectCode: liveProjectCode,
      runValue: liveRunValue,
      responsibleLabel: liveResponsible,
      severityValue: liveSeverity,
      priorityValue: livePriority,
    };
  }, [activeDefect, editDraft.applicationName, editDraft.priority, editDraft.projectCode, editDraft.runSlug, editDraft.severity, liveResponsibleLabel, selectedEditRun]);
  const hideDuplicatedProjectSummary = useMemo(
    () => hasDuplicatedApplicationAndProject(detailSummaryValues.applicationName, detailSummaryValues.projectCode),
    [detailSummaryValues.applicationName, detailSummaryValues.projectCode],
  );
  const mttrLabel = metrics.mttr == null ? copy.common.emptyValue : `${numberFormatter.format(metrics.mttr)}h`;
  const blockedQaseSummary = useMemo(() => {
    const unauthorized = blockedQaseProjects.filter((project) => project.reason === "unauthorized").length;
    const errors = blockedQaseProjects.length - unauthorized;
    return { unauthorized, errors };
  }, [blockedQaseProjects]);
  const integrationStatusLabel = useMemo(() => {
    if (integrationProviders.length === 0) return null;
    const label = integrationProviders
      .map((provider) => (provider === "qase" ? "Qase" : "Jira"))
      .join(" + ");
    return interpolate(copy.hero.integrationStatus, { value: label });
  }, [copy.hero.integrationStatus, integrationProviders]);

  const handleCreate = useCallback(async () => {
    if (!companySlug || !permissions.canCreate || !createDraft.title.trim()) return;
    setSaving(true);
    try {
      const evidence = createEvidenceFile
        ? await uploadEvidence(createEvidenceFile, slugifyRelease(createDraft.title) || `manual-${Date.now()}`)
        : null;
      const observations = [createDraft.description.trim(), evidence ? buildEvidenceMarkdown(evidence.name, evidence.url) : ""]
        .filter(Boolean)
        .join("\n\n");
      const response = await fetchApi("/api/releases-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "defect",
          slug: slugifyRelease(createDraft.title),
          name: createDraft.title.trim(),
          app: createDraft.applicationName.trim() || createDraft.projectCode.trim() || copy.create.manualApplicationFallback,
          qaseProject: createDraft.projectCode.trim() || createDraft.applicationName.trim(),
          runSlug: createDraft.runSlug.trim() || undefined,
          runName: selectedCreateRun?.name ?? undefined,
          clientSlug: companySlug,
          status: normalizeDefectStatus(createDraft.status),
          severity: createDraft.severity || undefined,
          priority: createDraft.priority || undefined,
          observations: observations || undefined,
          environments: createDraft.environments
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(localizeApiMessage(payload.message, copy.fallbackErrors.createManual));
      }
      const payload = (await response.json().catch(() => ({}))) as ManualDefectMutationResponse;
      const nextDefect = buildCompanyDefectFromManualPayload(payload, {
        canEdit: permissions.canEditManual,
        canDelete: permissions.canDeleteManual,
        canAssign: permissions.canEditManual,
        canComment: permissions.canComment,
      });
      setPageError(null);
      setCreateDraft(buildEmptyCreateDraft());
      setCreateEvidenceFile(null);
      resetFileInput(createEvidenceInputRef);
      setCreateApplicationMode(createApplicationOptions.length ? "catalog" : "custom");
      setCreateModalOpen(false);
      if (nextDefect) {
        upsertDefectLocally(nextDefect);
      } else {
        await loadOverview();
      }
    } catch (error) {
      setPageError(localizeClientError(error, copy.fallbackErrors.createManual));
    } finally {
      setSaving(false);
    }
  }, [
    companySlug,
    copy.create.manualApplicationFallback,
    copy.fallbackErrors.createManual,
    createApplicationOptions.length,
    createEvidenceFile,
    createDraft,
    loadOverview,
    localizeApiMessage,
    localizeClientError,
    permissions.canComment,
    permissions.canCreate,
    permissions.canDeleteManual,
    permissions.canEditManual,
    resetFileInput,
    selectedCreateRun,
    uploadEvidence,
    upsertDefectLocally,
  ]);

  const handleSaveManualDefect = useCallback(async () => {
    if (!activeDefect || activeDefect.sourceType !== "manual" || !activeDefect.canEdit) return;
    setSaving(true);
    try {
      const evidence = editEvidenceFile ? await uploadEvidence(editEvidenceFile, activeDefect.slug) : null;
      const observations = [
        editDraft.description.trim(),
        ...editEvidenceLinks.map((item) => item.raw),
        evidence ? buildEvidenceMarkdown(evidence.name, evidence.url) : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const response = await fetchApi(`/api/releases-manual/${encodeURIComponent(activeDefect.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editDraft.title.trim(),
          observations: observations || null,
          app: editDraft.applicationName.trim() || editDraft.projectCode.trim() || copy.create.manualApplicationFallback,
          qaseProject: editDraft.projectCode.trim() || editDraft.applicationName.trim() || null,
          status: normalizeDefectStatus(editDraft.status),
          severity: editDraft.severity || null,
          priority: editDraft.priority || null,
          assignedToUserId: editDraft.assignedToUserId.trim() || null,
          runSlug: editDraft.runSlug.trim() || null,
          runName: selectedEditRun?.name ?? null,
          environments: editDraft.environments
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(localizeApiMessage(payload.message, copy.fallbackErrors.saveManual));
      }
      const payload = (await response.json().catch(() => ({}))) as ManualDefectMutationResponse;
      const nextDefect = buildCompanyDefectFromManualPayload(payload, {
        fallback: activeDefect,
        canEdit: permissions.canEditManual,
        canDelete: permissions.canDeleteManual,
        canAssign: permissions.canEditManual,
        canComment: permissions.canComment,
      });
      setEditEvidenceFile(null);
      resetFileInput(editEvidenceInputRef);
      if (nextDefect) {
        setEditEvidenceLinks(parseDefectDescription(nextDefect.description).evidence);
        upsertDefectLocally(nextDefect);
      } else {
        await loadOverview({ preserveActiveSlug: activeDefect.slug });
      }
      void loadActivity(activeDefect.slug);
    } catch (error) {
      setDetailError(localizeClientError(error, copy.fallbackErrors.saveManual));
    } finally {
      setSaving(false);
    }
  }, [
    activeDefect,
    copy.create.manualApplicationFallback,
    copy.fallbackErrors.saveManual,
    editEvidenceFile,
    editEvidenceLinks,
    editDraft,
    loadActivity,
    loadOverview,
    localizeApiMessage,
    localizeClientError,
    permissions.canComment,
    permissions.canDeleteManual,
    permissions.canEditManual,
    resetFileInput,
    selectedEditRun,
    uploadEvidence,
    upsertDefectLocally,
  ]);

  const handleSaveIntegratedAssignee = useCallback(async () => {
    if (!activeDefect || activeDefect.sourceType !== "qase" || !activeDefect.canAssign || !companySlug) return;
    setSaving(true);
    try {
      const response = await fetchApi(`/api/company-defects/${encodeURIComponent(activeDefect.slug)}/assignee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companySlug,
          assignedToUserId: editDraft.assignedToUserId.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(localizeApiMessage(payload.message, copy.fallbackErrors.saveInternalAssignee));
      }
      const payload = (await response.json().catch(() => ({}))) as ActivityResponse;
      const nextDefect: CompanyDefect = {
        ...activeDefect,
        assignedToUserId: payload.summary?.assignedToUserId ?? null,
        assignedToName: payload.summary?.assignedToName ?? null,
        commentsCount: typeof payload.summary?.commentsCount === "number" ? payload.summary.commentsCount : activeDefect.commentsCount,
        lastCommentAt: payload.summary?.lastCommentAt ?? activeDefect.lastCommentAt,
      };
      upsertDefectLocally(nextDefect);
      void loadActivity(activeDefect.slug);
    } catch (error) {
      setDetailError(localizeClientError(error, copy.fallbackErrors.saveInternalAssignee));
    } finally {
      setSaving(false);
    }
  }, [activeDefect, companySlug, copy.fallbackErrors.saveInternalAssignee, editDraft.assignedToUserId, loadActivity, localizeApiMessage, localizeClientError, upsertDefectLocally]);

  const handleDelete = useCallback(async () => {
    if (!activeDefect || activeDefect.sourceType !== "manual" || !activeDefect.canDelete) return;
    setSaving(true);
    try {
      const response = await fetchApi(`/api/releases-manual/${encodeURIComponent(activeDefect.slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(localizeApiMessage(payload.message, copy.fallbackErrors.removeManual));
      }
      setActiveDefect(null);
      setDetailComments([]);
      setDetailHistory([]);
      setCommentBody("");
      updateUrlQuery({ defect: null });
      setDefects((current) => current.filter((item) => item.slug !== activeDefect.slug));
    } catch (error) {
      setDetailError(localizeClientError(error, copy.fallbackErrors.removeManual));
    } finally {
      setSaving(false);
    }
  }, [activeDefect, copy.fallbackErrors.removeManual, localizeApiMessage, localizeClientError, updateUrlQuery]);

  const handleComment = useCallback(async () => {
    if (!activeDefect || !companySlug || !permissions.canComment || (!commentBody.trim() && !commentEvidenceFile)) return;
    setSaving(true);
    try {
      const evidence = commentEvidenceFile ? await uploadEvidence(commentEvidenceFile, activeDefect.slug) : null;
      const body = [commentBody.trim(), evidence ? buildEvidenceMarkdown(evidence.name, evidence.url) : ""]
        .filter(Boolean)
        .join("\n\n");
      const response = await fetchApi(`/api/company-defects/${encodeURIComponent(activeDefect.slug)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companySlug,
          body,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(localizeApiMessage(payload.message, copy.fallbackErrors.publishComment));
      }
      const payload = (await response.json().catch(() => ({}))) as { item?: DefectComment | null };
      const nextComment = payload.item ?? null;
      setCommentBody("");
      setCommentEvidenceFile(null);
      resetFileInput(commentEvidenceInputRef);
      if (nextComment) {
        setDetailComments((current) => sortDefectComments([...current, nextComment]));
        upsertDefectLocally({
          ...activeDefect,
          commentsCount: activeDefect.commentsCount + 1,
          lastCommentAt: nextComment.createdAt,
        });
      } else {
        await loadActivity(activeDefect.slug);
      }
    } catch (error) {
      setDetailError(localizeClientError(error, copy.fallbackErrors.publishComment));
    } finally {
      setSaving(false);
    }
  }, [
    activeDefect,
    commentBody,
    commentEvidenceFile,
    companySlug,
    copy.fallbackErrors.publishComment,
    loadActivity,
    localizeApiMessage,
    localizeClientError,
    permissions.canComment,
    resetFileInput,
    uploadEvidence,
    upsertDefectLocally,
  ]);

  const closeDrawer = useCallback(() => {
    activityAbortRef.current?.abort();
    activityAbortRef.current = null;
    setActiveDefect(null);
    setDetailLoading(false);
    setDetailHistory([]);
    setDetailComments([]);
    setDetailTimelineNotice(null);
    setDetailError(null);
    setDetailTimelineError(null);
    setCommentBody("");
    setCommentEvidenceFile(null);
    setEditEvidenceLinks([]);
    setEditEvidenceFile(null);
    resetFileInput(commentEvidenceInputRef);
    resetFileInput(editEvidenceInputRef);
    updateUrlQuery({ defect: null });
  }, [resetFileInput, updateUrlQuery]);

  const openCreateModal = useCallback(() => {
    setPageError(null);
    setCreateEvidenceFile(null);
    resetFileInput(createEvidenceInputRef);
    setCreateModalOpen(true);
  }, [resetFileInput]);

  const closeCreateModal = useCallback(() => {
    setCreateEvidenceFile(null);
    resetFileInput(createEvidenceInputRef);
    setCreateModalOpen(false);
  }, [resetFileInput]);

  const clearAllFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    if (runFilter) updateUrlQuery({ run: null });
  }, [runFilter, updateUrlQuery]);

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10" data-testid="defects-page">
      <div className="mx-auto max-w-375 space-y-6">
        <header className="overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,#08173b_0%,#17397b_48%,#ef0001_100%)] p-5 text-white shadow-[0_24px_70px_rgba(11,26,60,0.16)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-white/70">{interpolate(copy.hero.kicker, { company: companyLabel })}</p>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">{copy.hero.title}</h1>
              <p className="mt-2 text-sm leading-6 text-white/80">
                {copy.hero.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {integrationStatusLabel && (
                <span className="rounded-full border border-emerald-200/40 bg-emerald-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-50 backdrop-blur">
                  {integrationStatusLabel}
                </span>
              )}
              {permissions.canCreate && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white backdrop-blur"
                >
                  {copy.hero.newDefect}
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-rose-100/90">{copy.metrics.openTitle}</p>
              <div className="mt-2 text-4xl font-black text-white">{metrics.open}</div>
              <p className="mt-2 text-sm text-white/70">{copy.metrics.openDescription}</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/90">{copy.metrics.qaseTitle}</p>
              <div className="mt-2 text-4xl font-black text-white">{metrics.qase}</div>
              <p className="mt-2 text-sm text-white/70">{copy.metrics.qaseDescription}</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-100/90">{copy.metrics.manualTitle}</p>
              <div className="mt-2 text-4xl font-black text-white">{metrics.manual}</div>
              <p className="mt-2 text-sm text-white/70">{copy.metrics.manualDescription}</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-violet-100/90">{copy.metrics.mttrTitle}</p>
              <div className="mt-2 text-4xl font-black text-white" data-testid="metric-mttr">
                {mttrLabel}
              </div>
              <p className="mt-2 text-sm text-white/70">{copy.metrics.mttrDescription}</p>
            </div>
          </div>
        </header>

        {(integrationWarning || blockedQaseProjects.length > 0) && (
          <section className="rounded-3xl border border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff7e6_100%)] p-5 shadow-[0_12px_35px_rgba(217,119,6,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-800">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {copy.blocked.badge}
                </div>
                <h2 className="mt-3 text-lg font-bold text-amber-950">{copy.blocked.title}</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {copy.blocked.description}
                </p>
                {integrationWarning && blockedQaseProjects.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm leading-6 text-amber-900">
                    {integrationWarning}
                  </p>
                ) : null}
              </div>
              {blockedQaseProjects.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm text-amber-900">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">{copy.blocked.blockedProjects}</p>
                    <p className="mt-2 text-3xl font-black text-amber-950">{blockedQaseProjects.length}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">{copy.blocked.blockedProjectsDescription}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm text-amber-900">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">{copy.blocked.unauthorized}</p>
                    <p className="mt-2 text-3xl font-black text-amber-950">{blockedQaseSummary.unauthorized}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">{copy.blocked.unauthorizedDescription}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 text-sm text-amber-900">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">{copy.blocked.technicalFailure}</p>
                    <p className="mt-2 text-3xl font-black text-amber-950">{blockedQaseSummary.errors}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">{copy.blocked.technicalFailureDescription}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {blockedQaseProjects.length > 0 ? (
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {blockedQaseProjects.map((project) => (
                  <div key={project.projectCode} className="rounded-[1.7rem] border border-amber-200 bg-white/90 p-5 shadow-[0_10px_28px_rgba(217,119,6,0.08)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-800">
                        {project.projectCode}
                      </span>
                      <span
                        className={
                          project.reason === "unauthorized"
                            ? "rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700"
                            : "rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700"
                        }
                      >
                        {project.reason === "unauthorized" ? copy.blocked.unauthorizedPill : copy.blocked.integrationFailurePill}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">{copy.blocked.whyUnavailable}</p>
                        <p className="mt-1 text-sm font-semibold text-amber-950">{formatBlockedQaseReason(project, copy)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">{copy.blocked.returnedDetail}</p>
                        <p className="mt-1 text-sm leading-6 text-amber-900">{formatBlockedQaseDetail(project, copy)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">{copy.blocked.howToFix}</p>
                        <p className="mt-1 text-sm leading-6 text-amber-950">{formatBlockedQaseAction(project, copy)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {pageError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError}
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-6">
            <section className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-6 text-(--tc-text-primary,#0b1a3c) shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#64748b)">{copy.filters.kicker}</p>
                  <h2 className="mt-2 text-xl font-bold">{copy.filters.title}</h2>
                  <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{copy.filters.subtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-primary,#0b1a3c) shadow-sm"
                  >
                    {copy.filters.clear}
                  </button>
                </div>
              </div>
              <div className="mt-5 rounded-3xl bg-(--tc-surface-2,#f8fafc) p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.7fr)_repeat(6,minmax(0,1fr))]">
                  <input
                    value={filters.search}
                    onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder={copy.filters.searchPlaceholder}
                    aria-label={copy.filters.searchAria}
                    title={copy.filters.searchAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm placeholder:text-(--tc-text-muted,#64748b) md:col-span-2 xl:col-span-1"
                  />
                  <select
                    value={filters.source}
                    onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as FilterState["source"] }))}
                    aria-label={copy.filters.sourceAria}
                    title={copy.filters.sourceAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm"
                  >
                    <option value="all">{copy.source.filterAll}</option>
                    <option value="manual">{copy.source.manual}</option>
                    <option value="qase">{copy.source.qase}</option>
                  </select>
                  <select
                    value={filters.application}
                    onChange={(event) => setFilters((current) => ({ ...current, application: event.target.value }))}
                    aria-label={copy.filters.applicationAria}
                    title={copy.filters.applicationAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm"
                  >
                    <option value="">{copy.filters.applicationAll}</option>
                    {applicationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={filters.startDate}
                    max={filters.endDate || undefined}
                    onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                    aria-label={copy.filters.startDateAria}
                    title={copy.filters.startDateAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm [color-scheme:dark]"
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    min={filters.startDate || undefined}
                    onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                    aria-label={copy.filters.endDateAria}
                    title={copy.filters.endDateAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm [color-scheme:dark]"
                  />
                  <select
                    value={filters.status}
                    onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FilterState["status"] }))}
                    aria-label={copy.filters.statusAria}
                    title={copy.filters.statusAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm"
                  >
                    <option value="all">{copy.status.filterAll}</option>
                    <option value="open">{copy.status.open}</option>
                    <option value="in_progress">{copy.status.inProgress}</option>
                    <option value="done">{copy.status.done}</option>
                  </select>
                  <select
                    value={filters.responsible}
                    onChange={(event) => setFilters((current) => ({ ...current, responsible: event.target.value }))}
                    aria-label={copy.filters.responsibleAria}
                    title={copy.filters.responsibleAria}
                    className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) shadow-sm"
                  >
                    <option value="">{copy.filters.responsibleAll}</option>
                    <option value="__unassigned__">{copy.filters.unassigned}</option>
                    {filterResponsibleOptions.map((option) => (
                      <option key={option.userId} value={option.userId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {activeFilterChips.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeFilterChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary,#4b5563) shadow-sm"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-4xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-6 text-(--tc-text-primary,#0b1a3c) shadow-[0_18px_50px_rgba(15,23,42,0.06)]" data-testid="defects-list">
              <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted,#64748b)">{copy.list.kicker}</p>
              <h2 className="mt-2 text-xl font-bold">{copy.list.title}</h2>
              <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">{copy.list.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-(--tc-text-secondary,#4b5563)">
                {interpolate(copy.list.cardsCount, { count: filteredDefects.length })}
              </span>
              <button
                type="button"
                onClick={() => loadOverview({ preserveActiveSlug: activeDefect?.slug ?? null, forceRefresh: true })}
                className="rounded-full border border-(--tc-border,#e5e7eb) px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em]"
              >
                {copy.list.reload}
              </button>
            </div>
          </div>

          {loading && <p className="mt-5 text-sm text-(--tc-text-muted)">{copy.list.loading}</p>}
          {!loading && defects.length === 0 && (
            <div className="mt-5 rounded-4xl border border-dashed border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-(--tc-text-primary,#0b1a3c) text-xl font-black text-(--tc-surface,#fff)">0</div>
              <p className="mt-5 text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.list.emptyTitle}</p>
              <p className="mx-auto mt-2 max-w-3xl text-sm text-(--tc-text-secondary,#4b5563)">
                {copy.list.emptyDescription}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => loadOverview({ preserveActiveSlug: activeDefect?.slug ?? null, forceRefresh: true })}
                  className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-primary,#0b1a3c)"
                >
                  {copy.list.reload}
                </button>
                {permissions.canCreate && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-primary,#0b1a3c)"
                  >
                    {copy.list.createManual}
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-primary,#0b1a3c)"
                >
                  {copy.filters.clear}
                </button>
              </div>
            </div>
          )}
          {!loading && defects.length > 0 && filteredDefects.length === 0 && (
            <div className="mt-5 rounded-4xl border border-dashed border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-(--tc-text-primary,#0b1a3c) text-xl font-black text-(--tc-surface,#fff)">0</div>
              <p className="mt-5 text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.list.filteredEmptyTitle}</p>
              <p className="mx-auto mt-2 max-w-3xl text-sm text-(--tc-text-secondary,#4b5563)">
                {copy.list.filteredEmptyDescription}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-primary,#0b1a3c)"
                >
                  {copy.filters.clear}
                </button>
                <button
                  type="button"
                  onClick={() => loadOverview({ preserveActiveSlug: activeDefect?.slug ?? null, forceRefresh: true })}
                  className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-primary,#0b1a3c)"
                >
                  {copy.list.reload}
                </button>
                {permissions.canCreate && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-(--tc-text-primary,#0b1a3c)"
                  >
                    {copy.list.createManual}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {filteredDefects.map((defect) => {
              const mttrHours = getDefectMttrHours(defect);
              const parsedDescription = parseDefectDescription(defect.description);
              const testId =
                defect.sourceType === "manual"
                  ? `defect-item-${defect.slug}`
                  : `defect-item-qase-${defect.slug}`;

              return (
                <article
                  key={defect.slug}
                  data-testid={testId}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-5 text-(--tc-text-primary,#0b1a3c) shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1.5 ${
                      defect.sourceType === "qase" ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {defect.sourceType === "qase" && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                            {copy.source.qase}
                          </span>
                        )}
                        <span className="rounded-full bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-secondary,#4b5563)">
                          {formatDefectStatus(defect.status, copy)}
                        </span>
                        {defect.commentsCount > 0 && (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:border dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                            {interpolate(copy.list.commentsCount, { count: defect.commentsCount })}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openDefect(defect)}
                        className="text-left text-xl font-bold text-(--tc-text-primary,#0b1a3c) transition-colors group-hover:text-(--tc-accent,#ef0001)"
                      >
                        {defect.title || defect.name}
                      </button>
                      {parsedDescription.text && (
                        <p className="max-w-3xl text-sm text-(--tc-text-secondary,#4b5563)">{parsedDescription.text}</p>
                      )}
                      {parsedDescription.evidence.length > 0 && (
                        <span className="inline-flex rounded-full bg-(--tc-surface-2,#f8fafc) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-secondary,#4b5563)">
                          {parsedDescription.evidence.length === 1
                            ? copy.evidence.oneAttached
                            : interpolate(copy.evidence.manyAttached, { count: parsedDescription.evidence.length })}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openDefect(defect)}
                        aria-label={copy.list.viewDetails}
                        title={copy.list.viewDetails}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-primary,#0b1a3c)"
                      >
                        <FiMaximize2 size={16} />
                      </button>
                      {defect.sourceType === "qase" && defect.externalUrl && (
                        <a
                          href={defect.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-700"
                        >
                          {copy.list.openInQase}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.application}</p>
                      <p className="mt-2 text-sm font-semibold">{defect.applicationName || copy.common.emptyValue}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.project}</p>
                      <p className="mt-2 text-sm font-semibold">{defect.projectCode || copy.common.emptyValue}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.responsible}</p>
                      <p className="mt-2 text-sm font-semibold">{defect.assignedToName || copy.list.notDefined}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.severity}</p>
                      <p className="mt-2 text-sm font-semibold">{formatDefectSeverity(defect.severity, copy)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.priority}</p>
                      <p className="mt-2 text-sm font-semibold">{formatDefectPriority(defect.priority, copy)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-(--tc-text-muted)">
                    <span>{copy.list.createdAt}: {formatDateTime(defect.createdAt, locale, copy.common.emptyValue)}</span>
                    <span>{copy.list.run}: {defect.runName || defect.runSlug || copy.common.emptyValue}</span>
                    <span>{copy.list.createdBy}: {defect.createdByName || copy.common.integration}</span>
                    <span>{copy.list.lastComment}: {formatDateTime(defect.lastCommentAt, locale, copy.common.emptyValue)}</span>
                    <span data-testid={mttrHours != null ? "defect-mttr" : undefined}>
                      {copy.list.mttr}: {mttrHours != null ? `${numberFormatter.format(mttrHours)}h` : copy.common.emptyValue}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
            </section>
          </div>
        </div>

      {permissions.canCreate && createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onMouseDown={closeCreateModal}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-4xl bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
            data-testid="defect-create-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f2350_0%,#213f88_48%,#b30f2d_100%)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{copy.create.kicker}</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-white">{copy.create.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-white/82">
                    {copy.create.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/16"
                  aria-label={copy.create.closeAria}
                  title={copy.create.closeTitle}
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-6">
              {pageError && (
                <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {pageError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  data-testid="defect-title"
                  value={createDraft.title}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder={copy.create.titlePlaceholder}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                />
                <select
                  value={
                    createApplicationMode === "custom"
                      ? "__custom__"
                      : selectedCreateApplication
                        ? `${selectedCreateApplication.name}||${selectedCreateApplication.projectCode ?? ""}`
                        : ""
                  }
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "__custom__") {
                      setCreateApplicationMode("custom");
                      setCreateDraft((current) => ({ ...current, applicationName: current.applicationName, projectCode: current.projectCode, runSlug: "" }));
                      return;
                    }
                    if (nextValue === "") {
                      setCreateApplicationMode(createApplicationOptions.length ? "catalog" : "custom");
                      setCreateDraft((current) => ({ ...current, applicationName: "", projectCode: "", runSlug: "" }));
                      return;
                    }
                    const selected = createApplicationOptions.find(
                      (item) => `${item.name}||${item.projectCode ?? ""}` === nextValue,
                    );
                    if (!selected) return;
                    setCreateApplicationMode("catalog");
                    setCreateDraft((current) => ({
                      ...current,
                      applicationName: selected.name,
                      projectCode: selected.projectCode ?? current.projectCode,
                      runSlug: "",
                    }));
                  }}
                  aria-label={copy.create.selectApplicationAria}
                  title={copy.create.selectApplicationAria}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                >
                  <option value="">{copy.create.selectApplication}</option>
                  {createApplicationOptions.map((option) => (
                    <option key={`${option.name}-${option.projectCode ?? "manual"}`} value={`${option.name}||${option.projectCode ?? ""}`}>
                      {option.name}
                      {option.source === "qase" ? copy.source.qaseSuffix : ""}
                    </option>
                  ))}
                  <option value="__custom__">{copy.create.otherApplication}</option>
                </select>

                {createApplicationMode === "custom" && (
                  <input
                    value={createDraft.applicationName}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, applicationName: event.target.value, runSlug: "" }))}
                    placeholder={copy.create.customApplicationPlaceholder}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm md:col-span-2"
                  />
                )}

                <select
                  value={createDraft.projectCode}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, projectCode: event.target.value, runSlug: "" }))}
                  aria-label={copy.create.selectProjectAria}
                  title={copy.create.selectProjectAria}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                >
                  <option value="">{copy.create.selectProject}</option>
                  {createProjectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                {createApplicationMode === "custom" && (
                  <input
                    value={createDraft.projectCode}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, projectCode: event.target.value, runSlug: "" }))}
                    placeholder={copy.create.customProjectPlaceholder}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                  />
                )}

                <div className="grid gap-3 sm:grid-cols-3 md:col-span-2">
                  <select
                    value={createDraft.status}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, status: event.target.value }))}
                    aria-label={copy.create.selectStatusAria}
                    title={copy.create.selectStatusAria}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                  >
                    {DEFECT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {interpolate(copy.status.prefix, { value: formatDefectStatus(option.value, copy) })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={createDraft.severity}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, severity: event.target.value }))}
                    aria-label={copy.create.selectSeverityAria}
                    title={copy.create.selectSeverityAria}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                  >
                    {DEFECT_SEVERITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {interpolate(copy.severity.prefix, { value: formatDefectSeverity(option.value, copy) })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={createDraft.priority}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, priority: event.target.value }))}
                    aria-label={copy.create.selectPriorityAria}
                    title={copy.create.selectPriorityAria}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm"
                  >
                    {DEFECT_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {interpolate(copy.priority.prefix, { value: formatDefectPriority(option.value, copy) })}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={createDraft.description}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder={copy.create.descriptionPlaceholder}
                  className="min-h-36 w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm md:col-span-2"
                />
                <input
                  ref={createEvidenceInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => setCreateEvidenceFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => createEvidenceInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700"
                  >
                    <FiPaperclip size={14} />
                    {createEvidenceFile ? copy.evidence.change : copy.evidence.attach}
                  </button>
                  {createEvidenceFile ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <span className="max-w-[18rem] truncate" title={createEvidenceFile.name}>
                        {createEvidenceFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateEvidenceFile(null);
                          resetFileInput(createEvidenceInputRef);
                        }}
                        aria-label={copy.evidence.remove}
                        title={copy.evidence.remove}
                        className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="md:col-span-2">
                  <RunSelectorField
                    value={createDraft.runSlug}
                    options={createRunOptions}
                    selectedOption={selectedCreateRun}
                    placeholder={copy.detail.runPlaceholder}
                    searchPlaceholder={copy.create.runSearchPlaceholder}
                    emptyLabel={copy.create.runEmpty}
                    clearLabel={copy.create.runClear}
                    ariaLabel={copy.create.runSelectAria}
                    onSelect={(nextSlug) => setCreateDraft((current) => ({ ...current, runSlug: nextSlug }))}
                  />
                </div>
                <input
                  value={createDraft.environments}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, environments: event.target.value }))}
                  placeholder={copy.create.environmentsPlaceholder}
                  title={copy.create.environmentsPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm md:col-span-2"
                />
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  {copy.create.cancel}
                </button>
                <button
                  type="button"
                  data-testid="defect-create"
                  onClick={handleCreate}
                  disabled={saving || !createDraft.title.trim()}
                  className="rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? copy.create.creating : copy.create.submit}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeDefect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={closeDrawer}
        >
          <div
            className="defect-detail-modal h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-4xl bg-(--tc-surface,#fff) text-(--tc-text-primary,#0b1a3c) shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
            data-testid="defect-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f2350_0%,#213f88_48%,#b30f2d_100%)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                      <FiMessageSquare size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{copy.detail.kicker}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] ${
                            activeDefect.sourceType === "manual"
                              ? "bg-white/12 text-white"
                              : "bg-emerald-400/16 text-emerald-100"
                          }`}
                        >
                          {formatRelativeOrigin(activeDefect.sourceType, copy)}
                        </span>
                        <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                          {formatDefectStatus(activeDefect.status, copy)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-2xl font-extrabold text-white">{activeDefect.title || activeDefect.name}</h2>
                      <p className="mt-2 max-w-3xl text-sm text-white/82">
                        {activeDefect.sourceType === "manual"
                          ? copy.detail.manualDescription
                          : copy.detail.qaseDescription}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white/45 bg-slate-950/58 text-white shadow-[0_18px_40px_rgba(15,23,42,0.34)] backdrop-blur-md transition hover:border-white/70 hover:bg-slate-950/78"
                    aria-label={copy.detail.closeAria}
                    title={copy.detail.closeTitle}
                  >
                    <FiX size={24} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {detailError && (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {detailError}
                  </div>
                )}

                <div className="mt-6 grid items-start gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="h-full rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-5 text-(--tc-text-primary,#0b1a3c)">
                    <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">{copy.detail.summary}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.application}</p>
                    <p className="mt-2 text-sm font-semibold">{detailSummaryValues.applicationName || copy.common.emptyValue}</p>
                  </div>
                  {!hideDuplicatedProjectSummary && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.project}</p>
                      <p className="mt-2 text-sm font-semibold">{detailSummaryValues.projectCode || copy.common.emptyValue}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.run}</p>
                    <p className="mt-2 text-sm font-semibold">{detailSummaryValues.runValue || copy.common.emptyValue}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.source.label}</p>
                    <p className="mt-2 text-sm font-semibold">{formatRelativeOrigin(activeDefect.sourceType, copy)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.createdBy}</p>
                    <p className="mt-2 text-sm font-semibold">{activeDefect.createdByName || copy.common.integration}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.responsible}</p>
                    <p className="mt-2 text-sm font-semibold">{detailSummaryValues.responsibleLabel || copy.list.notDefined}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.severity}</p>
                    <p className="mt-2 text-sm font-semibold">{formatDefectSeverity(detailSummaryValues.severityValue, copy)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-(--tc-text-muted)">{copy.list.priority}</p>
                    <p className="mt-2 text-sm font-semibold">{formatDefectPriority(detailSummaryValues.priorityValue, copy)}</p>
                  </div>
                    </div>
                    {activeDefect.externalUrl && (
                      <a
                        href={activeDefect.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-(--tc-text-primary,#0b1a3c)"
                      >
                        {copy.detail.openOriginal}
                      </a>
                    )}
                  </div>

                  <div className="h-full rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-5 text-(--tc-text-primary,#0b1a3c)">
                    <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">{copy.detail.operationalFields}</p>
                    <div className="mt-4 space-y-3">
                  <input
                    value={editDraft.title}
                    onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                    disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                    className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) placeholder:text-(--tc-text-muted,#64748b) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    placeholder={copy.detail.titlePlaceholder}
                  />
                  <input
                    ref={editEvidenceInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => setEditEvidenceFile(event.target.files?.[0] ?? null)}
                  />
                  <textarea
                    value={editDraft.description}
                    onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))}
                    disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                    className="min-h-28 w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) placeholder:text-(--tc-text-muted,#64748b) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    placeholder={copy.detail.descriptionPlaceholder}
                  />
                  {(editEvidenceLinks.length > 0 || editEvidenceFile || (activeDefect.sourceType === "manual" && activeDefect.canEdit)) && (
                    <div className="flex flex-wrap items-center gap-3">
                      {activeDefect.sourceType === "manual" && activeDefect.canEdit ? (
                        <button
                          type="button"
                          onClick={() => editEvidenceInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-primary,#0b1a3c)"
                        >
                          <FiPaperclip size={14} />
                          {editEvidenceFile ? copy.evidence.change : copy.evidence.attach}
                        </button>
                      ) : null}
                      {editEvidenceLinks.map((item) => (
                        <div
                          key={item.href}
                          className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-2 text-sm text-(--tc-text-primary,#0b1a3c)"
                        >
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[18rem] truncate font-medium text-sky-600 underline underline-offset-2 dark:text-sky-300"
                            title={getDefectEvidenceDisplayLabel(item.label)}
                          >
                            {getDefectEvidenceDisplayLabel(item.label)}
                          </a>
                          {activeDefect.sourceType === "manual" && activeDefect.canEdit ? (
                            <button
                              type="button"
                              onClick={() => setEditEvidenceLinks((current) => current.filter((entry) => entry.href !== item.href))}
                              aria-label={copy.evidence.remove}
                              title={copy.evidence.remove}
                              className="rounded-full p-1 text-(--tc-text-muted,#64748b) transition hover:bg-(--tc-surface-2,#f8fafc) hover:text-(--tc-text-primary,#0b1a3c)"
                            >
                              <FiX size={14} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {editEvidenceFile ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-2 text-sm text-(--tc-text-primary,#0b1a3c)">
                          <span className="max-w-[18rem] truncate" title={editEvidenceFile.name}>
                            {editEvidenceFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditEvidenceFile(null);
                              resetFileInput(editEvidenceInputRef);
                            }}
                            aria-label={copy.evidence.remove}
                            title={copy.evidence.remove}
                            className="rounded-full p-1 text-(--tc-text-muted,#64748b) transition hover:bg-(--tc-surface-2,#f8fafc) hover:text-(--tc-text-primary,#0b1a3c)"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <select
                      value={
                        selectedEditApplication
                          ? `${selectedEditApplication.name}||${selectedEditApplication.projectCode ?? ""}`
                          : ""
                      }
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === "") {
                          setEditDraft((current) => ({ ...current, applicationName: "", projectCode: "", runSlug: "" }));
                          return;
                        }
                        const selected = editApplicationOptions.find(
                          (item) => `${item.name}||${item.projectCode ?? ""}` === nextValue,
                        );
                        if (!selected) return;
                        setEditDraft((current) => ({
                          ...current,
                          applicationName: selected.name,
                          projectCode: selected.projectCode ?? "",
                          runSlug: "",
                        }));
                      }}
                      disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                      aria-label={copy.create.selectApplicationAria}
                      title={copy.create.selectApplicationAria}
                      className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    >
                      <option value="">{copy.create.selectApplication}</option>
                      {editApplicationOptions.map((option) => (
                        <option key={`${option.name}-${option.projectCode ?? "manual"}`} value={`${option.name}||${option.projectCode ?? ""}`}>
                          {option.name}
                          {option.source === "qase" ? copy.source.qaseSuffix : ""}
                        </option>
                      ))}
                    </select>
                    {!hideDuplicatedProjectField && (
                      <input
                        value={editDraft.projectCode}
                        onChange={(event) => setEditDraft((current) => ({ ...current, projectCode: event.target.value, runSlug: "" }))}
                        disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                        className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) placeholder:text-(--tc-text-muted,#64748b) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                        placeholder={copy.detail.projectPlaceholder}
                      />
                    )}
                    <select
                      data-testid="defect-status"
                      value={editDraft.status}
                      onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value }))}
                      disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                      aria-label={copy.detail.statusAria}
                      title={copy.detail.statusAria}
                      className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    >
                      {DEFECT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {formatDefectStatus(option.value, copy)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.severity}
                      onChange={(event) => setEditDraft((current) => ({ ...current, severity: event.target.value }))}
                      disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                      aria-label={copy.detail.severityAria}
                      title={copy.detail.severityAria}
                      className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    >
                      <option value="">{copy.severity.none}</option>
                      {DEFECT_SEVERITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {formatDefectSeverity(option.value, copy)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.priority}
                      onChange={(event) => setEditDraft((current) => ({ ...current, priority: event.target.value }))}
                      disabled={activeDefect.sourceType !== "manual" || !activeDefect.canEdit}
                      aria-label={copy.detail.priorityAria}
                      title={copy.detail.priorityAria}
                      className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    >
                      <option value="">{copy.priority.none}</option>
                      {DEFECT_PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {formatDefectPriority(option.value, copy)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.assignedToUserId}
                      onChange={(event) => setEditDraft((current) => ({ ...current, assignedToUserId: event.target.value }))}
                      disabled={activeDefect.sourceType === "manual" ? !activeDefect.canEdit : !activeDefect.canAssign}
                      aria-label={copy.detail.responsibleAria}
                      title={copy.detail.responsibleAria}
                      className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                    >
                      <option value="">{copy.filters.unassigned}</option>
                      {responsibleOptions.map((option) => (
                        <option key={option.userId} value={option.userId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {activeDefect.sourceType === "manual" && (
                      <>
                        <RunSelectorField
                          value={editDraft.runSlug}
                          options={editRunOptions}
                          selectedOption={selectedEditRun}
                          disabled={!activeDefect.canEdit}
                          placeholder={copy.detail.runPlaceholder}
                          searchPlaceholder={copy.detail.runSearchPlaceholder}
                          emptyLabel={copy.detail.runEmpty}
                          clearLabel={copy.detail.runClear}
                          ariaLabel={copy.detail.runSelectAria}
                          onSelect={(nextSlug) => setEditDraft((current) => ({ ...current, runSlug: nextSlug }))}
                        />
                        <input
                          value={editDraft.environments}
                          onChange={(event) => setEditDraft((current) => ({ ...current, environments: event.target.value }))}
                          disabled={!activeDefect.canEdit}
                          className="w-full rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#fff) px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) placeholder:text-(--tc-text-muted,#64748b) disabled:bg-(--tc-surface-2,#f8fafc) disabled:text-(--tc-text-muted,#64748b)"
                          placeholder={copy.detail.environmentsPlaceholder}
                          title={copy.detail.environmentsPlaceholder}
                        />
                      </>
                    )}
                  </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-3">
                  {activeDefect.sourceType === "manual" && activeDefect.canDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
                    >
                      {copy.detail.remove}
                    </button>
                  )}
                  {activeDefect.sourceType === "manual" && activeDefect.canEdit && (
                    <button
                      type="button"
                      data-testid="defect-save"
                      onClick={handleSaveManualDefect}
                      disabled={saving}
                      className="rounded-2xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {copy.detail.saveChanges}
                    </button>
                  )}
                  {activeDefect.sourceType === "qase" && activeDefect.canAssign && (
                    <button
                      type="button"
                      onClick={handleSaveIntegratedAssignee}
                      disabled={saving}
                      className="ticket-detail-primary-btn"
                    >
                      {copy.detail.saveAssignee}
                    </button>
                  )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid items-stretch gap-4 xl:grid-cols-2">
                  <section className="flex h-full min-h-120 flex-col rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-5 text-(--tc-text-primary,#0b1a3c)">
                    <div className="ticket-detail-chat-header">
                      <div className="ticket-detail-chat-icon">
                        <FiMessageSquare size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="ticket-detail-chat-title">{copy.comments.title}</p>
                        <p className="ticket-detail-chat-description">
                          {copy.comments.subtitle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => activeDefect && loadActivity(activeDefect.slug)}
                        className="rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-(--tc-text-primary,#0b1a3c)"
                      >
                        {copy.comments.refresh}
                      </button>
                    </div>

                    <div className="ticket-detail-comments mt-4 flex-1">
                      <div className="comments-chat">
                        <div
                          className={`comments-chat-list${!detailLoading && sortedDetailComments.length === 0 ? " comments-chat-list-empty" : ""}`}
                          aria-live="polite"
                        >
                          {detailLoading ? (
                            <p className="comments-chat-empty">{copy.comments.loading}</p>
                          ) : sortedDetailComments.length === 0 ? (
                            <p className="comments-chat-empty">{copy.comments.empty}</p>
                          ) : (
                            sortedDetailComments.map((comment) => {
                              const mine = comment.authorId === user?.id;
                              return (
                                <div key={comment.id} className={`comments-chat-message ${mine ? "mine" : "other"}`}>
                                  <div className="comments-chat-author-row">
                                    <div className="comments-chat-avatar" aria-hidden="true">
                                      <span>{getDefectCommentInitials(comment, mine, copy)}</span>
                                    </div>
                                    <div className="comments-chat-author-stack">
                                      <div className="comments-chat-author">{comment.authorName || (mine ? copy.comments.you : copy.comments.team)}</div>
                                      <div className="comments-chat-handle">
                                        {mine ? copy.comments.internalComment : copy.comments.internalCollaborator}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="comments-chat-bubble whitespace-pre-wrap">{renderDefectRichText(comment.body)}</div>
                                  <div className="comments-chat-meta">{formatDateTime(comment.createdAt, locale, copy.common.emptyValue)}</div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {activeDefect.canComment && (
                          <div className="comments-chat-input">
                            <input
                              ref={commentEvidenceInputRef}
                              type="file"
                              className="hidden"
                              onChange={(event) => setCommentEvidenceFile(event.target.files?.[0] ?? null)}
                            />
                            <textarea
                              value={commentBody}
                              onChange={(event) => setCommentBody(event.target.value)}
                              placeholder={copy.comments.inputPlaceholder}
                              className="ticket-detail-textarea"
                              rows={4}
                              maxLength={COMMENT_MAX_LENGTH}
                            />
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => commentEvidenceInputRef.current?.click()}
                                aria-label={commentEvidenceFile ? copy.evidence.change : copy.evidence.attach}
                                title={commentEvidenceFile ? copy.evidence.change : copy.evidence.attach}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) text-(--tc-text-primary,#0b1a3c)"
                              >
                                <FiPaperclip size={16} />
                              </button>
                              {commentEvidenceFile ? (
                                <div className="inline-flex items-center gap-2 rounded-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) px-3 py-2 text-sm text-(--tc-text-primary,#0b1a3c)">
                                  <span className="max-w-[16rem] truncate" title={commentEvidenceFile.name}>
                                    {commentEvidenceFile.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCommentEvidenceFile(null);
                                      resetFileInput(commentEvidenceInputRef);
                                    }}
                                    aria-label={copy.evidence.remove}
                                    title={copy.evidence.remove}
                                    className="rounded-full p-1 text-(--tc-text-muted,#64748b) transition hover:bg-(--tc-surface-2,#f8fafc) hover:text-(--tc-text-primary,#0b1a3c)"
                                  >
                                    <FiX size={14} />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <div className="comments-chat-actions">
                              <div className="comments-chat-status">
                                {detailError ? (
                                  <span className="ticket-detail-chat-error">{detailError}</span>
                                ) : (
                                  <span className="ticket-detail-chat-note">
                                    {copy.comments.visibilityNote}
                                  </span>
                                )}
                                <span
                                  className="ticket-detail-chat-counter"
                                  data-limit={
                                    commentLength >= COMMENT_MAX_LENGTH
                                      ? "max"
                                      : commentLength >= COMMENT_MAX_LENGTH * 0.9
                                        ? "warning"
                                        : "ok"
                                  }
                                >
                                  {interpolate(copy.comments.characters, { count: commentLength, max: COMMENT_MAX_LENGTH })}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleComment}
                                disabled={saving || (!commentBody.trim() && !commentEvidenceFile)}
                                className="ticket-detail-primary-btn"
                              >
                                <FiSend size={15} />
                                {saving ? copy.comments.sending : copy.comments.publish}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="flex h-full min-h-120 flex-col rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#fff) p-5 text-(--tc-text-primary,#0b1a3c)">
                    <p className="text-xs uppercase tracking-[0.3em] text-(--tc-text-muted)">{copy.timeline.kicker}</p>
                    <h3 className="mt-2 text-lg font-bold">{copy.timeline.title}</h3>
                    {detailTimelineNotice ? (
                      <p className="mt-2 rounded-2xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm leading-6 text-sky-900 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-100">
                        {detailTimelineNotice}
                      </p>
                    ) : null}
                    {detailTimelineError ? (
                      <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">
                        {detailTimelineError}
                      </p>
                    ) : null}
                    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
                      {detailLoading && <p className="text-sm text-(--tc-text-muted)">{copy.timeline.loading}</p>}
                      {!detailLoading && !detailTimelineError && visibleHistory.length === 0 && (
                        <p className="text-sm text-(--tc-text-muted)">{copy.timeline.empty}</p>
                      )}
                      {visibleHistory.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface-2,#f8fafc) p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                              {event.source === "qase" ? copy.timeline.qase : copy.timeline.platform}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{formatHistoryLabel(event, copy)}</p>
                          <p className="mt-2 text-xs text-(--tc-text-muted)">
                            {event.actorName || copy.common.system} - {formatDateTime(event.createdAt, locale, copy.common.emptyValue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
