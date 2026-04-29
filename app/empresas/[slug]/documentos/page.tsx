"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowUp,
  FiBookOpen,
  FiChevronRight,
  FiCopy,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiLink2,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import Breadcrumb from "@/components/Breadcrumb";
import DocumentViewer from "@/components/DocumentViewer";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fetchApi } from "@/lib/api";
import { buildCompanyPathForAccess, resolveCompanyRouteAccessInput } from "@/lib/companyRoutes";
import { useI18n } from "@/hooks/useI18n";

const COPY = {
  "pt-BR": {
    forbiddenKicker: "Documentos",
    forbiddenTitle: "Acesso negado",
    forbiddenDesc: "Você não tem permissão para consultar os documentos desta empresa.",
    breadcrumbDocs: "Documentos",
    headerKicker: "Documentação da empresa",
    headerDesc: "Repositório de arquivos, links e materiais de apoio da operação desta empresa.",
    heroRepoLabel: "Repositorio",
    heroFilesLabel: "Arquivos",
    heroLinksLabel: "Links",
    heroAccessLabel: "Acesso",
    heroAccessManage: "Gestao",
    heroAccessView: "Consulta",
    heroAccessManageNote: "Pode adicionar, editar e excluir documentos.",
    heroAccessViewNote: "Leitura liberada conforme o vinculo do usuario.",
    backToCompany: "Voltar para a empresa",
    openWiki: "Abrir repositório da empresa",
    viewWikis: "Ver repositórios das empresas",
    itemsRegistered: (n: number) => `${n} itens cadastrados`,
    filesCount: (n: number) => `${n} arquivos`,
    linksCount: (n: number) => `${n} links`,
    addFile: "Adicionar arquivo",
    addLink: "Adicionar link",
    linkCopied: "Link copiado.",
    copyFailed: "Não foi possível copiar o link.",
    fileKicker: "Arquivo da empresa",
    fileTitle: "Adicionar arquivo",
    fileDesc: "Envie um arquivo para manter materiais de apoio e referencias desta empresa em um único lugar.",
    close: "Fechar",
    labelTitle: "Título",
    labelFile: "Arquivo",
    labelDescription: "Descrição",
    placeholderFileTitle: "Ex.: Plano de testes da empresa",
    placeholderFileDesc: "Descreva o conteúdo ou a finalidade deste documento.",
    cancel: "Cancelar",
    submittingFile: "Enviando...",
    saveFile: "Salvar arquivo",
    linkKicker: "Link da empresa",
    linkTitle: "Adicionar link",
    linkDesc: "Cadastre links de referencia, páginas internas, materiais de apoio e documentação util para esta empresa.",
    labelUrl: "URL",
    placeholderLinkTitle: "Ex.: Guia de operação no Qase",
    placeholderLinkDesc: "Explique o contexto deste link e quando ele deve ser utilizado.",
    submittingLink: "Salvando...",
    saveLink: "Salvar link",
    repoKicker: "Repositório da empresa",
    repoTitle: "Documentos cadastrados",
    repoDesc: "Arquivos, links e referencias disponíveis para os usuários vinculados a esta empresa.",
    itemsLabel: (n: number) => `${n} itens`,
    fileLabel: "Arquivo",
    linkLabel: "Link",
    noDescDoc: "Sem descrição complementar.",
    addedAt: "Adicionado em",
    addedBy: "Adicionado por",
    systemUser: "Sistema",
    fileField: "Arquivo",
    sizeField: "Tamanho",
    destinationField: "Destino",
    openLink: "Abrir link",
    openFile: "Abrir arquivo",
    copyLink: "Copiar link",
    deleteBtn: "Excluir",
    emptyTitle: "Nenhum documento cadastrado",
    emptyDescManage: "Adicione arquivos ou links para montar a base de referencia desta empresa.",
    emptyDescView: "Ainda não existem documentos disponíveis para esta empresa.",
    confirmDelete: "Deseja excluir este documento da empresa?",
    deletedMsg: "Documento excluido.",
    fileAdded: "Arquivo adicionado com sucesso.",
    linkAdded: "Link adicionado com sucesso.",
    errAccessDenied: "Acesso negado",
    errLoadDocs: "Não foi possível carregar os documentos desta empresa.",
    errSelectFile: "Selecione um arquivo para continuar.",
    errSendFile: "Não foi possível enviar o arquivo.",
    errLinkUrl: "Informe a URL do link.",
    errSaveLink: "Não foi possível salvar o link.",
    errDeleteDoc: "Não foi possível excluir o documento.",
    deleteModalTitle: "Excluir documento",
    deleteModalDesc: "Esta ação é permanente e não pode ser desfeita. Deseja continuar?",
    deleteModalConfirm: "Excluir permanentemente",
    deleteModalCancel: "Cancelar",
    defaultCompany: "Empresa",
    defaultLinkTitle: "Link da empresa",
    editBtn: "Editar",
    editKicker: "Editar documento",
    editTitle: "Editar",
    saveEdit: "Salvar alterações",
    savingEdit: "Salvando...",
    editSuccess: "Documento atualizado.",
    errEditDoc: "Não foi possível atualizar o documento.",
    previewLink: "Testar link",
    searchPlaceholder: "Buscar por título, descrição, link, arquivo ou autor",
    searchResults: (shown: number, total: number) => shown === total ? `${total} itens na lista` : `${shown} de ${total} itens exibidos`,
    searchClear: "Limpar busca",
    resetFilters: "Limpar filtros",
    searchEmptyTitle: "Nenhum item encontrado",
    searchEmptyDesc: "Tente outro termo para localizar arquivos ou links deste repositório.",
    expandHint: "Clique para expandir os detalhes",
    identificationLabel: "Identificação",
    detailTitle: "Detalhes do item",
    detailDesc: "Consulte todos os campos e execute ações rápidas neste documento.",
    detailFieldsTitle: "Campos do item",
    brandLabel: "Testing Company",
    brandDesc: "Central de documentos e acessos rápidos.",
    originColumn: "Origem",
    titleColumn: "Título",
    createdColumn: "Criação",
    updatedColumn: "Última modificação",
    actionsColumn: "Ações",
    originLocal: "Upload local",
    originExternal: "Link externo",
    sortNone: "Sem ordenação",
    sortOrigin: "Origem",
    sortCreated: "Criação",
    sortUpdated: "Última modificação",
    typeFilterLabel: "Tipo",
    typeFilterAll: "Todos",
    typeFilterFile: "Arquivos",
    typeFilterLink: "Links",
    authorFilterLabel: "Autor",
    authorFilterAll: "Todos os autores",
    dateFilterLabel: "Data",
    dateFilterAll: "Qualquer data",
    dateFilter7d: "Últimos 7 dias",
    dateFilter30d: "Últimos 30 dias",
    dateFilter90d: "Últimos 90 dias",
    sortLabel: "Ordenar",
    sortRecent: "Mais recentes",
    sortOldest: "Mais antigos",
    sortTitle: "Título (A-Z)",
    sortAuthor: "Autor (A-Z)",
    createModalTitle: "Cadastrar item",
  },
  "en-US": {
    forbiddenKicker: "Documents",
    forbiddenTitle: "Access denied",
    forbiddenDesc: "You do not have permission to view documents for this company.",
    breadcrumbDocs: "Documents",
    headerKicker: "Company documentation",
    headerDesc: "Repository of files, links and support materials for this company's operations.",
    heroRepoLabel: "Repository",
    heroFilesLabel: "Files",
    heroLinksLabel: "Links",
    heroAccessLabel: "Access",
    heroAccessManage: "Manage",
    heroAccessView: "View",
    heroAccessManageNote: "Can add, edit and delete documents.",
    heroAccessViewNote: "Read access available according to the user's link.",
    backToCompany: "Back to company",
    openWiki: "Open company repository",
    viewWikis: "View company repositories",
    itemsRegistered: (n: number) => `${n} items registered`,
    filesCount: (n: number) => `${n} files`,
    linksCount: (n: number) => `${n} links`,
    addFile: "Add file",
    addLink: "Add link",
    linkCopied: "Link copied.",
    copyFailed: "Could not copy the link.",
    fileKicker: "Company file",
    fileTitle: "Add file",
    fileDesc: "Upload a file to keep support materials and references for this company in one place.",
    close: "Close",
    labelTitle: "Title",
    labelFile: "File",
    labelDescription: "Description",
    placeholderFileTitle: "E.g.: Company test plan",
    placeholderFileDesc: "Describe the content or purpose of this document.",
    cancel: "Cancel",
    submittingFile: "Uploading...",
    saveFile: "Save file",
    linkKicker: "Company link",
    linkTitle: "Add link",
    linkDesc: "Register reference links, internal pages, support materials and useful documentation for this company.",
    labelUrl: "URL",
    placeholderLinkTitle: "E.g.: Qase operation guide",
    placeholderLinkDesc: "Explain the context of this link and when it should be used.",
    submittingLink: "Saving...",
    saveLink: "Save link",
    repoKicker: "Company repository",
    repoTitle: "Registered documents",
    repoDesc: "Files, links and references available to users linked to this company.",
    itemsLabel: (n: number) => `${n} items`,
    fileLabel: "File",
    linkLabel: "Link",
    noDescDoc: "No additional description.",
    addedAt: "Added on",
    addedBy: "Added by",
    systemUser: "System",
    fileField: "File",
    sizeField: "Size",
    destinationField: "Destination",
    openLink: "Open link",
    openFile: "Open file",
    copyLink: "Copy link",
    deleteBtn: "Delete",
    emptyTitle: "No documents registered",
    emptyDescManage: "Add files or links to build the reference base for this company.",
    emptyDescView: "There are no documents available for this company yet.",
    confirmDelete: "Do you want to delete this company document?",
    deletedMsg: "Document deleted.",
    fileAdded: "File added successfully.",
    linkAdded: "Link added successfully.",
    errAccessDenied: "Access denied",
    errLoadDocs: "Could not load documents for this company.",
    errSelectFile: "Select a file to continue.",
    errSendFile: "Could not upload the file.",
    errLinkUrl: "Please enter the link URL.",
    errSaveLink: "Could not save the link.",
    errDeleteDoc: "Could not delete the document.",
    deleteModalTitle: "Delete document",
    deleteModalDesc: "This action is permanent and cannot be undone. Do you want to continue?",
    deleteModalConfirm: "Delete permanently",
    deleteModalCancel: "Cancel",
    defaultCompany: "Company",
    defaultLinkTitle: "Company link",
    editBtn: "Edit",
    editKicker: "Edit document",
    editTitle: "Edit",
    saveEdit: "Save changes",
    savingEdit: "Saving...",
    editSuccess: "Document updated.",
    errEditDoc: "Could not update the document.",
    previewLink: "Test link",
    viewerTitle: "Document viewer",
    viewerClose: "Close viewer",
    viewerPage: "Page",
    viewerOf: "of",
    viewerZoom: "Zoom",
    viewerDownload: "Download",
    searchPlaceholder: "Search by title, description, link, file, or author",
    searchResults: (shown: number, total: number) => shown === total ? `${total} items in the list` : `${shown} of ${total} items shown`,
    searchClear: "Clear search",
    resetFilters: "Reset filters",
    searchEmptyTitle: "No items found",
    searchEmptyDesc: "Try another term to find files or links in this repository.",
    expandHint: "Click to expand details",
    identificationLabel: "Identification",
    detailTitle: "Item details",
    detailDesc: "Review all fields and run quick actions for this document.",
    detailFieldsTitle: "Item fields",
    brandLabel: "Testing Company",
    brandDesc: "Documents center and quick actions.",
    originColumn: "Origin",
    titleColumn: "Title",
    createdColumn: "Created",
    updatedColumn: "Last modified",
    actionsColumn: "Actions",
    originLocal: "Local upload",
    originExternal: "External link",
    sortNone: "No sorting",
    sortOrigin: "Origin",
    sortCreated: "Created",
    sortUpdated: "Last modified",
    typeFilterLabel: "Type",
    typeFilterAll: "All",
    typeFilterFile: "Files",
    typeFilterLink: "Links",
    authorFilterLabel: "Author",
    authorFilterAll: "All authors",
    dateFilterLabel: "Date",
    dateFilterAll: "Any date",
    dateFilter7d: "Last 7 days",
    dateFilter30d: "Last 30 days",
    dateFilter90d: "Last 90 days",
    sortLabel: "Sort",
    sortRecent: "Most recent",
    sortOldest: "Oldest first",
    sortTitle: "Title (A-Z)",
    sortAuthor: "Author (A-Z)",
    createModalTitle: "Create item",
  },
} as const;

type DocumentItem = {
  id: string;
  kind: "file" | "link";
  title: string;
  description?: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  updatedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
};

type DocumentsResponse = {
  items?: DocumentItem[];
  canManage?: boolean;
  error?: string;
};

type DocumentTypeFilter = "all" | "file" | "link";
type DocumentDateFilter = "all" | "7d" | "30d" | "90d";
type DocumentSortKey = "none" | "origin" | "title" | "createdAt" | "updatedAt";
type DocumentCopy = (typeof COPY)[keyof typeof COPY];

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function getDocumentUpdatedAt(item: DocumentItem) {
  return item.updatedAt || item.createdAt;
}

function isLinkDocument(item: DocumentItem) {
  return item.kind === "link" && typeof item.url === "string" && item.url.trim().length > 0;
}

function safeHref(url: string) {
  if (!url || url === "#") return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildDocumentIdentifier(item: DocumentItem) {
  const prefix = item.kind === "file" ? "ARQ" : "LNK";
  return `${prefix}-${item.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function getDocumentAuthorLabel(item: DocumentItem, systemUserLabel: string) {
  return item.createdByName?.trim() || systemUserLabel;
}

function getDocumentOriginLabel(item: DocumentItem, copy: DocumentCopy) {
  return item.kind === "file" ? copy.originLocal : copy.originExternal;
}

function getDocumentSummaryLabel(item: DocumentItem, copy: DocumentCopy) {
  return item.kind === "file"
    ? `${copy.fileField}: ${item.fileName || copy.fileLabel}`
    : `${copy.destinationField}: ${item.url || "-"}`;
}

function toggleHeaderSort(current: DocumentSortKey, next: Exclude<DocumentSortKey, "none">) {
  return current === next ? current : next;
}

function matchesDocumentDateFilter(value: string, filter: DocumentDateFilter) {
  if (filter === "all") return true;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  const days = filter === "7d" ? 7 : filter === "30d" ? 30 : 90;
  const diff = Date.now() - timestamp;
  return diff <= days * 24 * 60 * 60 * 1000;
}

function matchesDocumentSearch(item: DocumentItem, query: string) {
  const haystack = [
    item.title,
    item.description,
    item.url,
    item.fileName,
    item.createdByName,
    item.createdBy,
    buildDocumentIdentifier(item),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function CompanyDocumentsPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "";
  const { clients, loading: clientsLoading } = useClientContext();
  const { user, normalizedUser } = useAuthUser();
  const { language } = useI18n();
  const copy = COPY[language] ?? COPY["pt-BR"];

  const routeInput = resolveCompanyRouteAccessInput({
    user,
    normalizedUser,
    companyCount: clients.length,
    clientSlug: slug,
  });

  const isCompanyOriginUser = useMemo(() => {
    const roles = [user?.permissionRole, user?.role, user?.companyRole].map((value) => (value ?? "").trim().toLowerCase());
    const isLeader = roles.includes("leader_tc") || user?.isGlobalAdmin === true || user?.is_global_admin === true;
    const isSupport = roles.includes("technical_support");
    if (isLeader || isSupport) return false;
    return roles.includes("empresa") || roles.includes("company_user") || routeInput.userOrigin === "client_company";
  }, [routeInput.userOrigin, user?.companyRole, user?.isGlobalAdmin, user?.is_global_admin, user?.permissionRole, user?.role]);

  const wikiHref = isCompanyOriginUser ? buildCompanyPathForAccess(slug, "docs", routeInput) : "/docs";
  const wikiButtonLabel = isCompanyOriginUser ? copy.openWiki : copy.viewWikis;

  const hasAccess = useMemo(() => {
    if (!slug) return false;
    if (clientsLoading) return true;
    return clients.some((client) => client.slug === slug);
  }, [clients, clientsLoading, slug]);

  const company = useMemo(() => clients.find((client) => client.slug === slug) ?? null, [clients, slug]);
  const companyName = company?.name || slug || copy.defaultCompany;

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [composer, setComposer] = useState<"file" | "link" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [linkTitle, setLinkTitle] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItem, setViewerItem] = useState<DocumentItem | null>(null);

  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DocumentDateFilter>("all");
  const [sortOrder, setSortOrder] = useState<DocumentSortKey>("none");


  const fileCount = useMemo(() => documents.filter((item) => item.kind === "file").length, [documents]);
  const linkCount = useMemo(() => documents.filter((item) => item.kind === "link").length, [documents]);
  const authorOptions = useMemo(() => {
    return Array.from(new Set(documents.map((item) => getDocumentAuthorLabel(item, copy.systemUser))))
      .sort((left, right) => left.localeCompare(right, language, { sensitivity: "base" }));
  }, [copy.systemUser, documents, language]);
  const hasActiveFilters = searchQuery.trim().length > 0 || typeFilter !== "all" || authorFilter !== "all" || dateFilter !== "all" || sortOrder !== "none";
  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = documents.filter((item) => {
      if (query && !matchesDocumentSearch(item, query)) return false;
      if (typeFilter !== "all" && item.kind !== typeFilter) return false;
      if (authorFilter !== "all" && getDocumentAuthorLabel(item, copy.systemUser) !== authorFilter) return false;
      if (!matchesDocumentDateFilter(item.createdAt, dateFilter)) return false;
      return true;
    });

    if (sortOrder === "none") return filtered;

    filtered.sort((left, right) => {
      if (sortOrder === "title") {
        return left.title.localeCompare(right.title, language, { sensitivity: "base" });
      }
      if (sortOrder === "origin") {
        return getDocumentOriginLabel(left, copy).localeCompare(getDocumentOriginLabel(right, copy), language, { sensitivity: "base" });
      }
      if (sortOrder === "createdAt") {
        const leftTime = new Date(right.createdAt).getTime();
        const rightTime = new Date(left.createdAt).getTime();
        const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
        const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
        return safeLeft - safeRight;
      }

      const leftTime = new Date(getDocumentUpdatedAt(right)).getTime();
      const rightTime = new Date(getDocumentUpdatedAt(left)).getTime();
      const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
      return safeLeft - safeRight;
    });

    return filtered;
  }, [authorFilter, copy, copy.systemUser, dateFilter, documents, language, searchQuery, sortOrder, typeFilter]);
  const detailItem = useMemo(() => documents.find((item) => item.id === detailItemId) ?? null, [documents, detailItemId]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchApi(`/api/company-documents?slug=${encodeURIComponent(slug)}`);
      const json = (await res.json().catch(() => ({}))) as DocumentsResponse;
      if (!res.ok) {
        setDocuments([]);
        setCanManage(false);
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
        }
        setError(json.error || copy.errLoadDocs);
        return;
      }

      setForbidden(false);
      setDocuments(Array.isArray(json.items) ? json.items : []);
      setCanManage(json.canManage === true);
    } catch (err) {
      setDocuments([]);
      setCanManage(false);
      setError(err instanceof Error ? err.message : copy.errLoadDocs);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (clientsLoading) return;
    if (!hasAccess) {
      setDocuments([]);
      setCanManage(false);
      setForbidden(true);
      setLoading(false);
      setError(copy.errAccessDenied);
      return;
    }
    load();
  }, [clientsLoading, hasAccess, load]);

  useEffect(() => {
    if (!detailItemId) return;
    if (detailItem) return;
    setDetailItemId(null);
    setEditing((current) => current?.id === detailItemId ? null : current);
  }, [detailItem, detailItemId]);

  useEffect(() => {
    if (authorFilter === "all") return;
    if (authorOptions.includes(authorFilter)) return;
    setAuthorFilter("all");
  }, [authorFilter, authorOptions]);

  function openItemDetails(item: DocumentItem) {
    setDetailItemId(item.id);
    if (editing?.id && editing.id !== item.id) {
      setEditing(null);
    }
  }

  function openComposer(kind: "file" | "link") {
    setEditing(null);
    setDetailItemId(null);
    setMessage(null);
    setError(null);
    setComposer(kind);
  }

  function resetListFilters() {
    setSearchQuery("");
    setTypeFilter("all");
    setAuthorFilter("all");
    setDateFilter("all");
    setSortOrder("none");
  }

  function handleHeaderSort(key: Exclude<DocumentSortKey, "none">) {
    setSortOrder((current) => toggleHeaderSort(current, key));
  }

  function clearHeaderSort(key: Exclude<DocumentSortKey, "none">) {
    setSortOrder((current) => current === key ? "none" : current);
  }

  function handleQuickOpen(item: DocumentItem) {
    if (isLinkDocument(item)) {
      window.open(safeHref(item.url || ""), "_blank", "noopener,noreferrer");
      return;
    }
    setViewerItem(item);
    setViewerOpen(true);
  }

  function closeItemDetails() {
    if (editing?.id === detailItemId) {
      setEditing(null);
    }
    setDetailItemId(null);
  }

  function startEditingItem(item: DocumentItem) {
    setComposer(null);
    setDetailItemId(item.id);
    setEditing(item);
    setEditTitle(item.title);
    setEditDesc(item.description ?? "");
    setEditUrl(item.url ?? "");
    setMessage(null);
    setError(null);
  }

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(copy.linkCopied);
      setError(null);
    } catch {
      setError(copy.copyFailed);
    }
  }

  async function submitFile() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    let file = uploadFile;
    if (!file && typeof document !== "undefined") {
      const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
      file = input?.files?.[0] ?? null;
    }

    if (!file) {
      setError(copy.errSelectFile);
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("title", (fileTitle.trim() || file.name).slice(0, 120));
      form.set("description", fileDescription.trim());
      form.set("file", file);

      const res = await fetchApi("/api/company-documents", {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errSendFile);
        return;
      }

      setFileTitle("");
      setFileDescription("");
      setUploadFile(null);
      try {
        const input = document.querySelector('[data-testid="doc-file-input"]') as HTMLInputElement | null;
        if (input) input.value = "";
      } catch {
        /* ignore */
      }
      setComposer(null);
      setMessage(copy.fileAdded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errSendFile);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLink() {
    if (!slug) return;
    setError(null);
    setMessage(null);

    if (!linkUrl.trim()) {
      setError(copy.errLinkUrl);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchApi("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          kind: "link",
          title: (linkTitle.trim() || copy.defaultLinkTitle).slice(0, 120),
          description: linkDescription.trim(),
          url: linkUrl.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errSaveLink);
        return;
      }

      setLinkTitle("");
      setLinkDescription("");
      setLinkUrl("");
      setComposer(null);
      setMessage(copy.linkAdded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errSaveLink);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!slug || !editing) return;
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        slug,
        id: editing.id,
        title: editTitle.trim() || editing.title,
        description: editDesc.trim(),
      };
      if (editing.kind === "link") {
        body.url = editUrl.trim() || editing.url;
      }
      const res = await fetchApi("/api/company-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errEditDoc);
        return;
      }
      setEditing(null);
      setMessage(copy.editSuccess);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errEditDoc);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!slug) return;
    setDeletingId(null);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchApi(`/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || copy.errDeleteDoc);
        return;
      }
      setDetailItemId((current) => current === id ? null : current);
      setEditing((current) => current?.id === id ? null : current);
      setViewerOpen((current) => current && viewerItem?.id !== id ? current : false);
      setViewerItem((current) => current?.id === id ? null : current);
      setMessage(copy.deletedMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errDeleteDoc);
    }
  }

  if (forbidden || (!clientsLoading && !hasAccess)) {
    return (
      <div className="min-h-screen bg-(--page-bg,#ffffff) px-6 py-10 text-(--page-text,#0b1a3c)">
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
          <div className="w-full rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.forbiddenKicker}</p>
            <h1 className="mt-3 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{copy.forbiddenTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
              {copy.forbiddenDesc}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 pb-6">
        <Breadcrumb items={[{ label: companyName, href: currentCompanyHref(slug) }, { label: copy.breadcrumbDocs }]} />

        <div className="flex w-full flex-col gap-6">
          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
          ) : null}

          <section className="tc-panel sm:p-6">
            <div className="tc-panel-header border-b border-(--tc-border,#d7deea) pb-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="tc-panel-kicker">{copy.repoKicker}</p>
                  <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.repoTitle}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                    {copy.repoDesc}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={wikiHref}
                      className="inline-flex items-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                    >
                      <FiBookOpen className="h-4 w-4" /> {wikiButtonLabel}
                    </Link>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (composer === "file") {
                            setComposer(null);
                            return;
                          }
                          openComposer("file");
                        }}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          composer === "file"
                            ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white"
                            : "border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-primary,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
                        }`}
                      >
                        <FiUploadCloud className="h-4 w-4" /> {copy.addFile}
                      </button>
                    ) : null}
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (composer === "link") {
                            setComposer(null);
                            return;
                          }
                          openComposer("link");
                        }}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          composer === "link"
                            ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white"
                            : "border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-primary,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
                        }`}
                      >
                        <FiPlus className="h-4 w-4" /> {copy.addLink}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-2xl">
                  <div className="tc-panel-muted">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                      {copy.heroRepoLabel}
                    </p>
                    <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{documents.length}</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{copy.itemsRegistered(documents.length)}</p>
                  </div>
                  <div className="tc-panel-muted">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                      {copy.heroFilesLabel}
                    </p>
                    <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{fileCount}</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{copy.filesCount(fileCount)}</p>
                  </div>
                  <div className="tc-panel-muted">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">
                      {copy.heroLinksLabel}
                    </p>
                    <p className="mt-2 text-2xl font-extrabold text-(--tc-text-primary,#0b1a3c)">{linkCount}</p>
                    <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">{copy.linksCount(linkCount)}</p>
                  </div>
                </div>
              </div>
            </div>

          {loading ? (
            <div className="space-y-3 pt-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-200" />
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-2">
                          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" />
                        </div>
                        <div className="mt-3 h-6 w-2/3 animate-pulse rounded-full bg-slate-200" />
                        <div className="mt-2 h-4 w-full animate-pulse rounded-full bg-slate-200" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-107.5">
                      {Array.from({ length: 3 }).map((__, metaIndex) => (
                        <div key={metaIndex} className="rounded-2xl bg-white p-3">
                          <div className="h-3 w-16 animate-pulse rounded-full bg-slate-200" />
                          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-200" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex min-h-65 flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#6b7280)">
                <FiFileText className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.emptyTitle}</h3>
                <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                  {canManage
                    ? copy.emptyDescManage
                    : copy.emptyDescView}
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-6 space-y-4">
              <div className="rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <label className="relative flex-1">
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--tc-text-muted,#6b7280)" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={copy.searchPlaceholder}
                        className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white py-3 pr-4 pl-11 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {searchQuery.trim() ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="inline-flex items-center rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          {copy.searchClear}
                        </button>
                      ) : null}
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetListFilters}
                          className="inline-flex items-center rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                        >
                          {copy.resetFilters}
                        </button>
                      ) : null}
                      <span className="inline-flex min-h-10 items-center rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">
                        {copy.searchResults(filteredDocuments.length, documents.length)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: "all", label: copy.typeFilterAll },
                        { key: "file", label: copy.typeFilterFile },
                        { key: "link", label: copy.typeFilterLink },
                      ] as const).map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setTypeFilter(option.key)}
                          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            typeFilter === option.key
                              ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001) text-white"
                              : "border-(--tc-border,#d7deea) bg-white text-(--tc-text-primary,#0b1a3c) hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-176">
                      <label className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.authorFilterLabel}</span>
                        <select
                          value={authorFilter}
                          onChange={(event) => setAuthorFilter(event.target.value)}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        >
                          <option value="all">{copy.authorFilterAll}</option>
                          {authorOptions.map((author) => (
                            <option key={author} value={author}>{author}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.dateFilterLabel}</span>
                        <select
                          value={dateFilter}
                          onChange={(event) => setDateFilter(event.target.value as DocumentDateFilter)}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        >
                          <option value="all">{copy.dateFilterAll}</option>
                          <option value="7d">{copy.dateFilter7d}</option>
                          <option value="30d">{copy.dateFilter30d}</option>
                          <option value="90d">{copy.dateFilter90d}</option>
                        </select>
                      </label>

                      <label className="space-y-2 xl:hidden">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.sortLabel}</span>
                        <select
                          value={sortOrder}
                          onChange={(event) => setSortOrder(event.target.value as DocumentSortKey)}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        >
                          <option value="none">{copy.sortNone}</option>
                          <option value="origin">{copy.sortOrigin}</option>
                          <option value="title">{copy.sortTitle}</option>
                          <option value="createdAt">{copy.sortCreated}</option>
                          <option value="updatedAt">{copy.sortUpdated}</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {filteredDocuments.length === 0 ? (
                <div className="flex min-h-55 flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-6 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)">
                    <FiSearch className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.searchEmptyTitle}</h3>
                    <p className="max-w-xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{copy.searchEmptyDesc}</p>
                  </div>
                </div>
              ) : (
                <div data-testid="document-list" className="max-h-[70vh] overflow-auto rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff)">
                  <div className="sticky top-0 z-10 hidden border-b border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.05)] xl:grid xl:grid-cols-[16rem_minmax(0,1fr)_9.5rem_9.5rem_10rem] xl:items-center xl:gap-4">
                    <button
                      type="button"
                      onClick={() => handleHeaderSort("origin")}
                      onDoubleClick={() => clearHeaderSort("origin")}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.28em] transition ${sortOrder === "origin" ? "text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text-primary,#0b1a3c)"}`}
                    >
                      {copy.originColumn}
                      {sortOrder === "origin" ? <FiArrowUp className="h-3 w-3" /> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHeaderSort("title")}
                      onDoubleClick={() => clearHeaderSort("title")}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.28em] transition ${sortOrder === "title" ? "text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text-primary,#0b1a3c)"}`}
                    >
                      {copy.titleColumn}
                      {sortOrder === "title" ? <FiArrowUp className="h-3 w-3" /> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHeaderSort("createdAt")}
                      onDoubleClick={() => clearHeaderSort("createdAt")}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.28em] transition ${sortOrder === "createdAt" ? "text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text-primary,#0b1a3c)"}`}
                    >
                      {copy.createdColumn}
                      {sortOrder === "createdAt" ? <FiArrowUp className="h-3 w-3" /> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHeaderSort("updatedAt")}
                      onDoubleClick={() => clearHeaderSort("updatedAt")}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.28em] transition ${sortOrder === "updatedAt" ? "text-(--tc-accent,#ef0001)" : "text-(--tc-text-muted,#6b7280) hover:text-(--tc-text-primary,#0b1a3c)"}`}
                    >
                      {copy.updatedColumn}
                      {sortOrder === "updatedAt" ? <FiArrowUp className="h-3 w-3" /> : null}
                    </button>
                    <div className="text-right text-[10px] font-semibold uppercase tracking-[0.28em] text-(--tc-text-muted,#6b7280)">{copy.actionsColumn}</div>
                  </div>
                  <div className="divide-y divide-(--tc-border,#d7deea)">
                    {filteredDocuments.map((item) => {
                      const identifier = buildDocumentIdentifier(item);
                      const updatedAt = getDocumentUpdatedAt(item);
                      const authorLabel = getDocumentAuthorLabel(item, copy.systemUser);
                      const originLabel = getDocumentOriginLabel(item, copy);
                      const summaryLabel = getDocumentSummaryLabel(item, copy);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openItemDetails(item)}
                          title={copy.expandHint}
                          aria-label={`${item.title}. ${copy.expandHint}`}
                          className="group w-full cursor-pointer px-4 py-2.5 text-left transition hover:bg-(--tc-surface-alt,#f8fafc)"
                        >
                          <div className="grid gap-2.5 xl:grid-cols-[16rem_minmax(0,1fr)_9.5rem_9.5rem_10rem] xl:items-center xl:gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                                  item.kind === "file"
                                    ? "border border-slate-200 bg-white text-slate-600"
                                    : "border border-rose-100 bg-rose-50 text-rose-600"
                                }`}>
                                  {item.kind === "file" ? <FiPaperclip className="h-3 w-3" /> : <FiLink2 className="h-3 w-3" />}
                                  {originLabel}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-(--tc-border,#d7deea) bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
                                  {identifier}
                                </span>
                              </div>
                              <p className="mt-1.5 truncate text-[11px] font-medium text-(--tc-text-secondary,#4b5563)">{copy.addedBy}: {authorLabel}</p>
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{item.title}</h3>
                              <p className="mt-0.5 truncate text-[11px] leading-4 text-(--tc-text-secondary,#4b5563)">{item.description || copy.noDescDoc}</p>
                              <p className="mt-0.5 truncate text-[11px] leading-4 text-(--tc-text-muted,#6b7280)">{summaryLabel}</p>
                              <div className="mt-1.5 grid gap-1 text-[11px] text-(--tc-text-muted,#6b7280) xl:hidden">
                                <span>{copy.createdColumn}: {formatDate(item.createdAt)}</span>
                                <span>{copy.updatedColumn}: {formatDate(updatedAt)}</span>
                              </div>
                            </div>

                            <div className="hidden xl:block">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.createdColumn}</p>
                              <p className="mt-1 text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{formatDate(item.createdAt)}</p>
                            </div>

                            <div className="hidden xl:block">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.updatedColumn}</p>
                              <p className="mt-1 text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{formatDate(updatedAt)}</p>
                            </div>

                            <div className="flex items-center justify-start gap-1 pt-1 xl:justify-end xl:pt-0">
                              <button
                                type="button"
                                title={item.kind === "file" ? copy.openFile : copy.openLink}
                                aria-label={item.kind === "file" ? copy.openFile : copy.openLink}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleQuickOpen(item);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                              >
                                <FiExternalLink className="h-3.5 w-3.5" />
                              </button>
                              {item.kind === "link" ? (
                                <button
                                  type="button"
                                  title={copy.copyLink}
                                  aria-label={copy.copyLink}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleCopyLink(item.url || "");
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                                >
                                  <FiCopy className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              {canManage ? (
                                <button
                                  type="button"
                                  title={copy.editBtn}
                                  aria-label={copy.editBtn}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startEditingItem(item);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                                >
                                  <FiEdit2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              {canManage ? (
                                <button
                                  type="button"
                                  title={copy.deleteBtn}
                                  aria-label={copy.deleteBtn}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeletingId(item.id);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100"
                                >
                                  <FiTrash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              <span className="hidden items-center gap-1.5 pl-1 text-(--tc-accent,#ef0001) xl:inline-flex" aria-hidden="true">
                                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-0 transition duration-200 group-hover:animate-pulse group-hover:opacity-100" />
                                <FiChevronRight className="h-3.5 w-3.5 opacity-35 transition duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          </section>

          {detailItem ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="document-detail-title"
              className="fixed inset-0 z-40 overflow-y-auto bg-black/45 px-4 py-4 backdrop-blur-sm sm:py-8"
              onClick={(event) => { if (event.target === event.currentTarget) closeItemDetails(); }}
            >
              <div className="pointer-events-none flex min-h-full items-start justify-center">
                <div
                  className="pointer-events-auto my-2 w-full max-w-4xl overflow-hidden rounded-4xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="bg-[linear-gradient(135deg,#071e53_0%,#142b63_42%,#ef0001_100%)] px-4 py-4 sm:px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                            <Image
                              src="/images/tc.png"
                              alt={copy.brandLabel}
                              width={32}
                              height={32}
                              className="h-8 w-8 object-contain"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/72">{copy.brandLabel}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                                detailItem.kind === "file"
                                  ? "border border-white/22 bg-white/10 text-white"
                                  : "border border-rose-100/70 bg-white/12 text-white"
                              }`}>
                                {detailItem.kind === "file" ? <FiPaperclip className="h-3 w-3" /> : <FiLink2 className="h-3 w-3" />}
                                {detailItem.kind === "file" ? copy.fileLabel : copy.linkLabel}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-white/22 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/82">
                                {copy.identificationLabel}: {buildDocumentIdentifier(detailItem)}
                              </span>
                            </div>
                            <h2 id="document-detail-title" className="mt-3 truncate text-2xl font-bold text-white">
                              {editing?.id === detailItem.id ? `${copy.editTitle} — ${detailItem.title}` : detailItem.title}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-white/78">
                              {editing?.id === detailItem.id ? copy.editKicker : copy.brandDesc}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={closeItemDetails}
                        className="inline-flex items-center rounded-xl border border-white/18 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/14"
                      >
                        {copy.close}
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                  {editing?.id === detailItem.id ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className={`space-y-2${detailItem.kind === "file" ? " lg:col-span-2" : ""}`}>
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelTitle}</span>
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>

                      {detailItem.kind === "link" ? (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelUrl}</span>
                          <input
                            aria-label={copy.labelUrl}
                            value={editUrl}
                            onChange={(event) => setEditUrl(event.target.value)}
                            className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                          />
                          {editUrl.trim() ? (
                            <a
                              href={safeHref(editUrl.trim())}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                            >
                              <FiExternalLink className="h-3 w-3" /> {copy.previewLink}
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelDescription}</span>
                        <textarea
                          value={editDesc}
                          onChange={(event) => setEditDesc(event.target.value)}
                          rows={5}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                      <div className="space-y-3">
                        <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">{copy.detailTitle}</p>
                          <p className="mt-3 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{detailItem.description || copy.noDescDoc}</p>
                          <p className="mt-2 text-[11px] leading-5 text-(--tc-text-muted,#6b7280)">{getDocumentSummaryLabel(detailItem, copy)}</p>
                          {detailItem.kind === "link" && detailItem.url ? (
                            <a
                              href={safeHref(detailItem.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiExternalLink className="h-4 w-4" /> {copy.previewLink}
                            </a>
                          ) : null}
                        </div>

                        <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">{copy.detailFieldsTitle}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.addedAt}</p>
                              <p className="mt-1.5 text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{formatDate(detailItem.createdAt)}</p>
                            </div>
                            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.updatedColumn}</p>
                              <p className="mt-1.5 text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{formatDate(getDocumentUpdatedAt(detailItem))}</p>
                            </div>
                            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.addedBy}</p>
                              <p className="mt-1.5 wrap-break-word text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{detailItem.createdByName || copy.systemUser}</p>
                            </div>
                            <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3 sm:col-span-2 lg:col-span-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.identificationLabel}</p>
                              <p className="mt-1.5 text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{buildDocumentIdentifier(detailItem)}</p>
                            </div>
                            {detailItem.kind === "file" ? (
                              <>
                                <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3 sm:col-span-2 lg:col-span-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.fileField}</p>
                                  <p className="mt-1.5 wrap-break-word text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{detailItem.fileName || copy.fileLabel}</p>
                                </div>
                                <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.sizeField}</p>
                                  <p className="mt-1.5 text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{formatBytes(detailItem.sizeBytes)}</p>
                                </div>
                              </>
                            ) : (
                              <div className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3 sm:col-span-2 lg:col-span-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{copy.destinationField}</p>
                                <p className="mt-1.5 wrap-break-word text-[13px] font-semibold leading-5 text-(--tc-text-primary,#0b1a3c)">{detailItem.url || "-"}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-4 xl:self-start">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--tc-text-muted,#6b7280)">{copy.heroAccessLabel}</p>
                        <div className="mt-3 space-y-2.5">
                          {detailItem.kind === "link" ? (
                            <a
                              href={safeHref(detailItem.url || "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiExternalLink className="h-4 w-4" /> {copy.openLink}
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setViewerItem(detailItem);
                                setViewerOpen(true);
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiExternalLink className="h-4 w-4" /> {copy.openFile}
                            </button>
                          )}

                          {detailItem.kind === "link" ? (
                            <button
                              type="button"
                              onClick={() => void handleCopyLink(detailItem.url || "")}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiCopy className="h-4 w-4" /> {copy.copyLink}
                            </button>
                          ) : null}

                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => startEditingItem(detailItem)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-2.5 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            >
                              <FiEdit2 className="h-4 w-4" /> {copy.editBtn}
                            </button>
                          ) : null}

                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => setDeletingId(detailItem.id)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                            >
                              <FiTrash2 className="h-4 w-4" /> {copy.deleteBtn}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {editing?.id === detailItem.id ? (
                  <div className="flex flex-col-reverse gap-3 border-t border-(--tc-border,#d7deea) px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="w-full rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001) sm:w-auto"
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitEdit()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      <FiEdit2 className="h-4 w-4" /> {submitting ? copy.savingEdit : copy.saveEdit}
                    </button>
                  </div>
                ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {composer !== null ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="composer-modal-title"
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
              onClick={(event) => { if (event.target === event.currentTarget) setComposer(null); }}
            >
              <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-4xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
                <div className="flex items-start justify-between gap-4 border-b border-(--tc-border,#d7deea) px-5 py-5 sm:px-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">{copy.createModalTitle}</p>
                    <h2 id="composer-modal-title" className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">
                      {composer === "file" ? copy.fileTitle : copy.linkTitle}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                      {composer === "file" ? copy.fileDesc : copy.linkDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComposer(null)}
                    className="inline-flex items-center rounded-xl border border-(--tc-border,#d7deea) px-3 py-2 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                  >
                    {copy.close}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  {composer === "file" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelTitle}</span>
                        <input
                          data-testid="doc-file-title"
                          value={fileTitle}
                          onChange={(event) => setFileTitle(event.target.value)}
                          placeholder={copy.placeholderFileTitle}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelFile}</span>
                        <input
                          data-testid="doc-file-input"
                          type="file"
                          onChange={(event) => setUploadFile(event.currentTarget.files?.[0] ?? null)}
                          className="w-full rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-[0.9rem] text-sm text-(--tc-text-secondary,#4b5563) outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-(--tc-accent,#ef0001) file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelDescription}</span>
                        <textarea
                          data-testid="doc-file-description"
                          value={fileDescription}
                          onChange={(event) => setFileDescription(event.target.value)}
                          rows={5}
                          placeholder={copy.placeholderFileDesc}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelTitle}</span>
                        <input
                          data-testid="doc-link-title"
                          value={linkTitle}
                          onChange={(event) => setLinkTitle(event.target.value)}
                          placeholder={copy.placeholderLinkTitle}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>
                      <div className="space-y-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelUrl}</span>
                        <input
                          data-testid="doc-link-url"
                          value={linkUrl}
                          onChange={(event) => setLinkUrl(event.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                        {linkUrl.trim() ? (
                          <a
                            href={safeHref(linkUrl.trim())}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-(--tc-accent,#ef0001) hover:underline"
                          >
                            <FiExternalLink className="h-3 w-3" /> {copy.previewLink}
                          </a>
                        ) : null}
                      </div>
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-sm font-semibold text-(--tc-text-primary,#0b1a3c)">{copy.labelDescription}</span>
                        <textarea
                          data-testid="doc-link-description"
                          value={linkDescription}
                          onChange={(event) => setLinkDescription(event.target.value)}
                          rows={5}
                          placeholder={copy.placeholderLinkDesc}
                          className="w-full rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm text-(--tc-text-primary,#0b1a3c) outline-none transition focus:border-(--tc-accent,#ef0001)"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-(--tc-border,#d7deea) px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6">
                  <button
                    type="button"
                    onClick={() => setComposer(null)}
                    className="w-full rounded-2xl border border-(--tc-border,#d7deea) px-4 py-3 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001) sm:w-auto"
                  >
                    {copy.cancel}
                  </button>
                  {composer === "file" ? (
                    <button
                      data-testid="doc-file-submit"
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitFile()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      <FiUploadCloud className="h-4 w-4" /> {submitting ? copy.submittingFile : copy.saveFile}
                    </button>
                  ) : (
                    <button
                      data-testid="doc-link-submit"
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitLink()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      <FiLink2 className="h-4 w-4" /> {submitting ? copy.submittingLink : copy.saveLink}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DocumentViewer
            open={viewerOpen}
            item={viewerItem}
            slug={slug}
            onClose={() => setViewerOpen(false)}
            copy={copy}
          />

          {deletingId !== null ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setDeletingId(null); }}
            >
              <div className="w-full max-w-sm rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600">
                  <FiTrash2 className="h-5 w-5" />
                </div>
                <h2 id="delete-modal-title" className="mt-4 text-xl font-bold text-(--tc-text-primary,#0b1a3c)">{copy.deleteModalTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{copy.deleteModalDesc}</p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingId(null)}
                    className="rounded-2xl border border-(--tc-border,#d7deea) px-4 py-2.5 text-sm font-semibold text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                  >
                    {copy.deleteModalCancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteDocument(deletingId)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <FiTrash2 className="h-4 w-4" /> {copy.deleteModalConfirm}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function currentCompanyHref(slug: string) {
  const normalized = slug.trim();
  return normalized ? "../home" : "/admin/clients";
}
