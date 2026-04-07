"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import loginStyles from "../LoginClient.module.css";
import styles from "./AccessRequestClient.module.css";
import type {
  AccessRequestAdjustmentEntry,
  AccessRequestAdjustmentField,
  AccessRequestAdjustmentRound,
  AccessRequestSnapshot,
} from "@/lib/accessRequestMessage";
import { normalizeRequestProfileType, requestProfileTypeNeedsCompany } from "@/lib/requestRouting";
import { JOB_TITLE_OPTIONS } from "@/lib/jobTitles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACCESS_OPTIONS = [
  {
    value: "testing_company_user",
    label: "Usuario TC",
    hint: "Usuario interno da Testing Company.",
  },
  {
    value: "company_user",
    label: "Usuario da empresa",
    hint: "Usuario vinculado ao contexto da empresa.",
  },
  {
    value: "testing_company_lead",
    label: "Lider TC",
    hint: "Perfil institucional da Testing Company.",
  },
  {
    value: "technical_support",
    label: "Suporte Tecnico",
    hint: "Atuacao tecnica e operacional da Testing Company.",
  },
];
const EMPTY_JOB_TITLE = "__empty_job_title__";

type CompanyOption = {
  id: string;
  name: string;
  active?: boolean;
};

type CompanyRequestDraft = {
  companyName: string;
  companyTaxId: string;
  companyZip: string;
  companyAddress: string;
  companyPhone: string;
  companyWebsite: string;
  companyLinkedin: string;
  companyDescription: string;
  companyNotes: string;
};

type LookupItem = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  email: string;
  name: string;
  fullName?: string | null;
  username?: string | null;
  phone?: string | null;
  jobRole?: string | null;
  company?: string | null;
  clientId?: string | null;
  accessType?: string | null;
  profileType?: string | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  companyProfile?: CompanyRequestDraft | null;
  originalRequest?: AccessRequestSnapshot | null;
  adjustmentRound?: number;
  adjustmentRequestedFields?: AccessRequestAdjustmentField[];
  adjustmentHistory?: AccessRequestAdjustmentRound[];
  lastAdjustmentAt?: string | null;
  lastAdjustmentDiff?: AccessRequestAdjustmentEntry[];
  adminNotes?: string | null;
};

type AccessRequestComment = {
  id: string;
  authorRole: "admin" | "requester";
  authorName: string;
  body: string;
  createdAt: string;
};

type RequestTimelineEntry = {
  id: string;
  authorRole: "admin" | "requester";
  authorName: string;
  body: string;
  createdAt: string;
};

type AdjustmentFieldOption = {
  field: AccessRequestAdjustmentField;
  label: string;
};

const BASE_ADJUSTMENT_FIELD_OPTIONS: AdjustmentFieldOption[] = [
  { field: "profileType", label: "Perfil" },
  { field: "company", label: "Empresa" },
  { field: "fullName", label: "Nome completo" },
  { field: "username", label: "Usuário sugerido" },
  { field: "email", label: "E-mail" },
  { field: "phone", label: "Telefone" },
  { field: "jobRole", label: "Cargo" },
  { field: "title", label: "Título" },
  { field: "description", label: "Descrição" },
  { field: "notes", label: "Observações" },
  { field: "password", label: "Senha" },
];

const COMPANY_ADJUSTMENT_FIELD_OPTIONS: AdjustmentFieldOption[] = [
  { field: "companyName", label: "Razão social" },
  { field: "companyTaxId", label: "CNPJ" },
  { field: "companyZip", label: "CEP" },
  { field: "companyAddress", label: "Endereço" },
  { field: "companyPhone", label: "Telefone da empresa" },
  { field: "companyWebsite", label: "Website" },
  { field: "companyLinkedin", label: "LinkedIn" },
  { field: "companyDescription", label: "Descrição da empresa" },
  { field: "companyNotes", label: "Observações da empresa" },
];

type LookupDraft = {
  fullName: string;
  name: string;
  user: string;
  email: string;
  phone: string;
  company: string;
  clientId: string;
  role: string;
  accessType: "testing_company_user" | "company_user" | "testing_company_lead" | "technical_support";
  title: string;
  description: string;
  notes: string;
  password: string;
  companyProfile: CompanyRequestDraft;
};

function emptyCompanyRequestDraft(): CompanyRequestDraft {
  return {
    companyName: "",
    companyTaxId: "",
    companyZip: "",
    companyAddress: "",
    companyPhone: "",
    companyWebsite: "",
    companyLinkedin: "",
    companyDescription: "",
    companyNotes: "",
  };
}

function textOrFallback(value: string | null | undefined, fallback = "Não informado") {
  return value && value.trim() ? value : fallback;
}

function adjustmentFieldLabel(field: AccessRequestAdjustmentField, fallback = "Campo") {
  return (
    [...BASE_ADJUSTMENT_FIELD_OPTIONS, ...COMPANY_ADJUSTMENT_FIELD_OPTIONS].find((option) => option.field === field)?.label ?? fallback
  );
}

export default function AccessRequestClient() {
  const [fullName, setFullName] = useState("");
  const [requestedUser, setRequestedUser] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientId, setClientId] = useState("");
  const [companyDraft, setCompanyDraft] = useState<CompanyRequestDraft>(emptyCompanyRequestDraft);
  const [role, setRole] = useState("");
  const [accessType, setAccessType] = useState<
    "testing_company_user" | "company_user" | "testing_company_lead" | "technical_support"
  >("testing_company_user");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);

  const [lookupName, setLookupName] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupItem, setLookupItem] = useState<LookupItem | null>(null);
  const [lookupDraft, setLookupDraft] = useState<LookupDraft | null>(null);
  const [lookupComments, setLookupComments] = useState<AccessRequestComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [lookupSaving, setLookupSaving] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const lookupNameRef = useRef<HTMLInputElement>(null);
  const requestNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLookupOpen && !isRequestOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLookupOpen(false);
        setIsRequestOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLookupOpen, isRequestOpen]);

  useEffect(() => {
    if (!isLookupOpen) return;
    const timer = window.setTimeout(() => lookupNameRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isLookupOpen]);

  useEffect(() => {
    if (!isRequestOpen && !isLookupOpen) return;
    const timer = window.setTimeout(() => requestNameRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isLookupOpen, isRequestOpen]);

  useEffect(() => {
    if (!isRequestOpen) return;

    let mounted = true;
    setCompaniesLoading(true);
    setCompaniesError(null);

    fetch("/api/public/clients", { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as { items?: CompanyOption[] } | null;
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar as empresas cadastradas.");
        }
        if (!mounted) return;
        const items = Array.isArray(json?.items) ? json.items : [];
        setCompanyOptions(items.filter((item) => item.active !== false));
      })
      .catch((err) => {
        if (!mounted) return;
        setCompanyOptions([]);
        setCompaniesError(err instanceof Error ? err.message : "Nao foi possivel carregar as empresas cadastradas.");
      })
      .finally(() => {
        if (!mounted) return;
        setCompaniesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isRequestOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedRequestedUser = requestedUser.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const normalizedRole = role.trim();
    const normalizedPassword = password.trim();
    const normalizedTitle = titulo.trim();
    const normalizedDescription = descricao.trim();
    const normalizedCompanyDraft = {
      companyName: companyDraft.companyName.trim(),
      companyTaxId: companyDraft.companyTaxId.trim(),
      companyZip: companyDraft.companyZip.trim(),
      companyAddress: companyDraft.companyAddress.trim(),
      companyPhone: companyDraft.companyPhone.trim(),
      companyWebsite: companyDraft.companyWebsite.trim(),
      companyLinkedin: companyDraft.companyLinkedin.trim(),
      companyDescription: companyDraft.companyDescription.trim(),
      companyNotes: companyDraft.companyNotes.trim(),
    };

    if (
      !normalizedFullName ||
      !normalizedEmail ||
      !normalizedPhone ||
      !normalizedRole ||
      !normalizedTitle ||
      !normalizedDescription ||
      !normalizedPassword
    ) {
      setError("Preencha nome completo, e-mail, telefone, cargo, título, descrição e senha.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("E-mail inválido.");
      return;
    }
    if (normalizedPassword.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (accessType === "technical_support" && !normalizedRequestedUser) {
      setError("Informe o usuario/login para o perfil Suporte Tecnico.");
      return;
    }

    const normalizedClientId = clientId.trim();
    const requiresCompany = requestProfileTypeNeedsCompany(accessType);
    const selectedCompany = companyOptions.find((item) => item.id === normalizedClientId) ?? null;
    const normalizedCompany = selectedCompany?.name?.trim() ?? "";
    const isCompanyProfile = accessType === "company_user";

    if (requiresCompany && !normalizedClientId) {
      setError("Selecione uma empresa para realizar a solicitacao.");
      return;
    }

    if (requiresCompany && !selectedCompany) {
      setError("Selecione uma empresa cadastrada valida para continuar.");
      return;
    }
    if (isCompanyProfile && !normalizedCompanyDraft.companyName) {
      setError("Preencha o nome ou razao social da empresa.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/support/access-request", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: normalizedFullName,
          name: normalizedFullName,
          user: accessType === "technical_support" ? normalizedRequestedUser || undefined : undefined,
          email: normalizedEmail,
          phone: normalizedPhone,
          company: normalizedCompany,
          client_id: normalizedClientId,
          role: normalizedRole,
          profile_type: accessType,
          title: normalizedTitle,
          description: normalizedDescription,
          password: normalizedPassword,
          company_name: isCompanyProfile ? normalizedCompanyDraft.companyName : undefined,
          company_tax_id: isCompanyProfile ? normalizedCompanyDraft.companyTaxId : undefined,
          company_zip: isCompanyProfile ? normalizedCompanyDraft.companyZip : undefined,
          company_address: isCompanyProfile ? normalizedCompanyDraft.companyAddress : undefined,
          company_phone: isCompanyProfile ? normalizedCompanyDraft.companyPhone : undefined,
          company_website: isCompanyProfile ? normalizedCompanyDraft.companyWebsite : undefined,
          company_linkedin: isCompanyProfile ? normalizedCompanyDraft.companyLinkedin : undefined,
          company_description: isCompanyProfile ? normalizedCompanyDraft.companyDescription : undefined,
          company_notes: isCompanyProfile ? normalizedCompanyDraft.companyNotes : undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Erro ao registrar solicitação.");
      }

      setSuccess("Solicitação enviada. Use a opção Consultar solicitação para acompanhar o andamento e as respostas.");
      setFullName("");
      setRequestedUser("");
      setEmail("");
      setPhone("");
      setClientId("");
      setCompanyDraft(emptyCompanyRequestDraft());
      setRole("");
      setTitulo("");
      setDescricao("");
      setPassword("");
      setAccessType("testing_company_user");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === "closed") return "Aprovada";
    if (status === "rejected") return "Rejeitada";
    if (status === "in_progress") return "Em análise";
    return "Aberta";
  };

  const statusTone = (status: string) => {
    if (status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
    if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-100 text-slate-700";
  };

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError(null);
    setLookupItem(null);
    setLookupDraft(null);
    setLookupComments([]);
    setCommentDraft("");

    const normalizedEmail = lookupEmail.trim().toLowerCase();
    const normalizedName = lookupName.trim();

    if (!normalizedName || !normalizedEmail) {
      setLookupError("Informe nome e e-mail para consultar.");
      return;
    }

    setLookupLoading(true);
    try {
      const res = await fetch(
        `/api/support/access-request/lookup?name=${encodeURIComponent(normalizedName)}&email=${encodeURIComponent(
          normalizedEmail,
        )}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => null)) as {
        item?: LookupItem;
        comments?: AccessRequestComment[];
        error?: string;
      };
      if (!res.ok) {
        setLookupError(json?.error || "Solicitação não encontrada.");
        return;
      }
      setLookupItem(json.item ?? null);
      setLookupDraft(
        json.item
          ? {
              fullName: json.item.fullName?.trim() || json.item.name?.trim() || "",
              name: json.item.fullName?.trim() || json.item.name?.trim() || "",
              user: json.item.username?.trim() || "",
              email: json.item.email?.trim() || "",
              phone: json.item.phone?.trim() || "",
              company: json.item.company?.trim() || "",
              clientId: json.item.clientId?.trim() || "",
              role: json.item.jobRole?.trim() || "",
              accessType:
                normalizeRequestProfileType(json.item.profileType ?? json.item.accessType ?? "") ?? "testing_company_user",
              title: json.item.title?.trim() || "",
              description: json.item.description?.trim() || "",
              notes: json.item.notes?.trim() || "",
              password: "",
              companyProfile: json.item.companyProfile ?? emptyCompanyRequestDraft(),
            }
          : null,
      );
      setLookupComments(Array.isArray(json.comments) ? json.comments : []);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao consultar solicitação.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!lookupItem) return;
    const body = commentDraft.trim();
    if (!body) return;

    setCommentSubmitting(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/support/access-request/comments", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: lookupItem.id,
          name: lookupName.trim(),
          email: lookupEmail.trim().toLowerCase(),
          comment: body,
        }),
      });
      const json = (await res.json().catch(() => null)) as { item?: AccessRequestComment; error?: string };
      if (!res.ok) {
        setLookupError(json?.error || "Falha ao enviar comentário.");
        return;
      }
      if (json.item) {
        setLookupComments((prev) => [...prev, json.item as AccessRequestComment]);
      }
      setCommentDraft("");
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao enviar comentário.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const adminNote = lookupItem?.adminNotes?.trim() || "";
  const canEditLookup = Boolean(lookupItem && lookupDraft && lookupItem.status !== "closed" && lookupItem.status !== "rejected");
  const requestedLookupFields = useMemo(
    () => new Set<AccessRequestAdjustmentField>(lookupItem?.adjustmentRequestedFields ?? []),
    [lookupItem?.adjustmentRequestedFields],
  );
  const latestLookupAdjustmentRound = lookupItem?.adjustmentHistory?.[lookupItem.adjustmentHistory.length - 1] ?? null;
  const hasLookupCompanyDraft = Boolean(lookupItem?.originalRequest?.companyProfile || lookupItem?.companyProfile);
  const lookupAdjustmentFieldOptions = useMemo(
    () => (hasLookupCompanyDraft ? [...BASE_ADJUSTMENT_FIELD_OPTIONS, ...COMPANY_ADJUSTMENT_FIELD_OPTIONS] : BASE_ADJUSTMENT_FIELD_OPTIONS),
    [hasLookupCompanyDraft],
  );
  const restrictLookupEditing =
    lookupItem?.status === "in_progress" && requestedLookupFields.size > 0;
  const timelineEntries = useMemo<RequestTimelineEntry[]>(() => {
    if (!lookupItem) return [];

    const entries: RequestTimelineEntry[] = [];

    const hasAdminNoteInComments =
      Boolean(adminNote) &&
      lookupComments.some(
        (comment) => comment.authorRole === "admin" && comment.body.trim() === adminNote,
      );

    if (adminNote && !hasAdminNoteInComments) {
      entries.push({
        id: `${lookupItem.id}-admin-note`,
        authorRole: "admin",
        authorName: "Admin",
        body: adminNote,
        createdAt: lookupItem.updatedAt || lookupItem.createdAt,
      });
    }

    for (const comment of lookupComments) {
      entries.push({
        id: comment.id,
        authorRole: comment.authorRole,
        authorName: comment.authorName?.trim() || (comment.authorRole === "admin" ? "Admin" : "Solicitante"),
        body: comment.body,
        createdAt: comment.createdAt,
      });
    }

    return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [adminNote, lookupComments, lookupItem]);

  const inputBase =
    "form-control-user w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-sm text-[#011848] placeholder:text-[#94a3b8] focus:ring-2 focus:ring-[#ef0001]/40 focus:border-[#ef0001]/60 transition-all duration-200";

  const textareaBase =
    "form-control-user w-full rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-sm text-[#011848] placeholder:text-[#94a3b8] focus:ring-2 focus:ring-[#ef0001]/40 focus:border-[#ef0001]/60 transition-all duration-200";

  const labelClass = "space-y-2 text-sm font-semibold text-[#011848]";
  const selectedAccessOption = ACCESS_OPTIONS.find((option) => option.value === accessType) ?? ACCESS_OPTIONS[0];
  const selectedLookupAccessOption =
    ACCESS_OPTIONS.find((option) => option.value === (lookupDraft?.accessType ?? "testing_company_user")) ?? ACCESS_OPTIONS[0];
  const isCompanyAccessRequest = accessType === "company_user";
  const isTechnicalSupportRequest = accessType === "technical_support";
  const isLookupCompanyAccessRequest = lookupDraft?.accessType === "company_user";
  const isLookupTechnicalSupportRequest = lookupDraft?.accessType === "technical_support";

  const isLookupFieldEditable = (field: AccessRequestAdjustmentField) => {
    if (!canEditLookup) return false;
    if (!restrictLookupEditing) return true;
    return requestedLookupFields.has(field);
  };

  const lookupFieldClass = (field: AccessRequestAdjustmentField) =>
    `${inputBase} ${
      requestedLookupFields.has(field)
        ? "border-rose-300 bg-rose-50 text-rose-700 placeholder:text-rose-300 focus:border-rose-400 focus:ring-rose-200/60"
        : ""
    }`;

  const lookupTextareaClass = (field: AccessRequestAdjustmentField) =>
    `${textareaBase} ${
      requestedLookupFields.has(field)
        ? "border-rose-300 bg-rose-50 text-rose-700 placeholder:text-rose-300 focus:border-rose-400 focus:ring-rose-200/60"
        : ""
    }`;

  async function handleUpdateLookup() {
    if (!lookupItem || !lookupDraft) return;

    const normalizedEmail = lookupDraft.email.trim().toLowerCase();
    const normalizedFullName = lookupDraft.fullName.trim();
    const normalizedPhone = lookupDraft.phone.trim();
    const normalizedRole = lookupDraft.role.trim();
    const normalizedTitle = lookupDraft.title.trim();
    const normalizedDescription = lookupDraft.description.trim();
    const normalizedClientId = lookupDraft.clientId.trim();
    const normalizedPassword = lookupDraft.password.trim();
    const normalizedCompanyDraft = {
      companyName: lookupDraft.companyProfile.companyName.trim(),
      companyTaxId: lookupDraft.companyProfile.companyTaxId.trim(),
      companyZip: lookupDraft.companyProfile.companyZip.trim(),
      companyAddress: lookupDraft.companyProfile.companyAddress.trim(),
      companyPhone: lookupDraft.companyProfile.companyPhone.trim(),
      companyWebsite: lookupDraft.companyProfile.companyWebsite.trim(),
      companyLinkedin: lookupDraft.companyProfile.companyLinkedin.trim(),
      companyDescription: lookupDraft.companyProfile.companyDescription.trim(),
      companyNotes: lookupDraft.companyProfile.companyNotes.trim(),
    };

    if (
      !normalizedFullName ||
      !normalizedEmail ||
      !normalizedPhone ||
      !normalizedRole ||
      !normalizedTitle ||
      !normalizedDescription
    ) {
      setLookupError("Preencha os campos obrigatorios para reenviar a solicitacao.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setLookupError("E-mail invalido.");
      return;
    }

    const requiresCompany = requestProfileTypeNeedsCompany(lookupDraft.accessType);
    const selectedCompany = companyOptions.find((item) => item.id === normalizedClientId) ?? null;
    const isCompanyProfile = lookupDraft.accessType === "company_user";
    if (requiresCompany && !normalizedClientId) {
      setLookupError("Selecione uma empresa para reenviar a solicitacao.");
      return;
    }
    if (requiresCompany && !selectedCompany) {
      setLookupError("Selecione uma empresa cadastrada valida para continuar.");
      return;
    }
    if (isCompanyProfile && !normalizedCompanyDraft.companyName) {
      setLookupError("Preencha o nome ou razao social da empresa.");
      return;
    }
    if (lookupDraft.accessType === "technical_support" && !lookupDraft.user.trim()) {
      setLookupError("Informe o usuario/login para o perfil Suporte tecnico.");
      return;
    }
    if (normalizedPassword && normalizedPassword.length < 8) {
      setLookupError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setLookupSaving(true);
    setLookupError(null);
    try {
      const response = await fetch("/api/support/access-request/update", {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: lookupItem.id,
          lookup_name: lookupName.trim(),
          lookup_email: lookupEmail.trim().toLowerCase(),
          full_name: normalizedFullName,
          name: normalizedFullName,
          user: lookupDraft.accessType === "technical_support" ? lookupDraft.user.trim().toLowerCase() : undefined,
          email: normalizedEmail,
          phone: normalizedPhone,
          company: selectedCompany?.name?.trim() || lookupDraft.company.trim(),
          client_id: requiresCompany ? normalizedClientId : "",
          role: normalizedRole,
          profile_type: lookupDraft.accessType,
          title: normalizedTitle,
          description: normalizedDescription,
          notes: lookupDraft.notes.trim(),
          password: normalizedPassword || undefined,
          company_name: isCompanyProfile ? normalizedCompanyDraft.companyName : undefined,
          company_tax_id: isCompanyProfile ? normalizedCompanyDraft.companyTaxId : undefined,
          company_zip: isCompanyProfile ? normalizedCompanyDraft.companyZip : undefined,
          company_address: isCompanyProfile ? normalizedCompanyDraft.companyAddress : undefined,
          company_phone: isCompanyProfile ? normalizedCompanyDraft.companyPhone : undefined,
          company_website: isCompanyProfile ? normalizedCompanyDraft.companyWebsite : undefined,
          company_linkedin: isCompanyProfile ? normalizedCompanyDraft.companyLinkedin : undefined,
          company_description: isCompanyProfile ? normalizedCompanyDraft.companyDescription : undefined,
          company_notes: isCompanyProfile ? normalizedCompanyDraft.companyNotes : undefined,
        }),
      });

      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setLookupError(json?.error || "Nao foi possivel atualizar a solicitacao.");
        return;
      }

      setLookupDraft((current) => (current ? { ...current, password: "" } : current));
      await handleLookup(new Event("submit") as unknown as FormEvent<HTMLFormElement>);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Erro ao atualizar solicitacao.");
    } finally {
      setLookupSaving(false);
    }
  }

  return (
    <div
      className={
        `${loginStyles.loginContainer} ${loginStyles.loginFixedTheme} min-h-svh flex items-start sm:items-center justify-start sm:justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] relative isolate z-2147483647 overflow-x-hidden overflow-y-auto px-4 py-10 pointer-events-auto sm:px-6 md:px-10`
      }
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        <div className="absolute top-10 left-44 w-16 h-16 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#011848] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[#011848] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="relative z-10 w-full max-w-3xl space-y-8 sm:space-y-10 md:max-w-4xl">
        <div className={`text-center ${styles.introBase} ${styles.introDelay1}`}>
          <h2 className="text-3xl font-bold leading-tight text-[#011848] drop-shadow-sm sm:text-4xl">
            Solicitações de acesso
          </h2>
          <p className="text-[#0b1a3c] font-medium">
            Consulte uma solicitação existente ou envie um novo pedido de acesso ao painel.
          </p>
        </div>

        <div className="space-y-4">
          <div
            className={`bg-white/90 backdrop-blur-sm border border-[#011848]/10 shadow-2xl rounded-2xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
              styles.introBase
            } ${styles.introDelay2}`}
          >
            <div>
              <h3 className="text-lg font-semibold text-[#011848]">Consultar solicitação</h3>
              <p className="text-sm text-[#475569]">
                Acompanhe o status e os comentários da sua solicitação em tempo real.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLookupOpen(true);
                setIsRequestOpen(false);
                setLookupError(null);
              }}
              title="Consultar agora"
              className="inline-flex items-center justify-center rounded-xl border border-[#011848]/15 bg-white px-5 py-2 text-sm font-semibold text-[#011848] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#011848]/5 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/50"
            >
              Consultar agora
            </button>
          </div>

          <div
            className={`bg-white/90 backdrop-blur-sm border border-[#011848]/10 shadow-2xl rounded-2xl px-6 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
              styles.introBase
            } ${styles.introDelay3}`}
          >
            <div>
              <h3 className="text-lg font-semibold text-[#011848]">Solicitar acesso</h3>
              <p className="text-sm text-[#475569]">
                Envie um novo pedido de acesso e nossa equipe vai orientar o próximo passo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRequestOpen(true);
                setIsLookupOpen(false);
                setError(null);
                setSuccess(null);
              }}
              title="Solicitar acesso"
              className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/60"
            >
              Solicitar acesso
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-[#475569]">
          <Link href="/login" className="font-semibold text-[#011848]/80 hover:text-[#011848]">
            Voltar ao login
          </Link>
        </div>
      </div>

      {isRequestOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4 ${
            styles.modalOverlay
          }`}
          onClick={() => setIsRequestOpen(false)}
          role="presentation"
        >
          <div
            className={`flex max-h-[calc(100svh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100svh-2rem)] sm:p-6 ${
              styles.modalPanel
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="request-title" className="text-xl font-semibold text-[#011848]">
                  Solicitar acesso
                </h3>
                <p className="text-sm text-[#475569]">
                  Preencha os dados abaixo para abrir uma nova solicitação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestOpen(false)}
                className="rounded-full border border-[#011848]/10 bg-white p-2 text-[#475569] transition hover:text-[#011848]"
                aria-label="Fechar modal"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            {success && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 shrink-0 rounded-2xl border border-emerald-300 bg-linear-to-r from-emerald-50 to-emerald-100 px-4 py-4 shadow-[0_12px_30px_rgba(16,185,129,0.14)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-white text-lg text-emerald-600">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">Solicitação enviada com sucesso</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">{success}</p>
                  </div>
                </div>
              </div>
            )}

            <form className="mt-5 flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <div className="space-y-2 text-sm font-semibold text-[#011848]">
                  <div className="flex items-center justify-between gap-3">
                    <span>Tipo de perfil</span>
                    <span className="text-right text-xs font-medium text-[#6b7280]">Escolha conforme seu papel</span>
                  </div>
                  <label className="sr-only" htmlFor="access-type-select">
                    Tipo de perfil
                  </label>
                  <select
                    id="access-type-select"
                    aria-label="Tipo de perfil"
                    value={accessType}
                    onChange={(event) => {
                      const next = event.target.value as
                        | "testing_company_user"
                        | "company_user"
                        | "testing_company_lead"
                        | "technical_support";
                      setAccessType(next);
                      if (!requestProfileTypeNeedsCompany(next)) {
                        setClientId("");
                      }
                    }}
                    className={inputBase}
                  >
                    {ACCESS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs font-medium text-[#64748b]">{selectedAccessOption.hint}</p>
                </div>

                {requestProfileTypeNeedsCompany(accessType) ? (
                  <label className={labelClass}>
                    Empresa vinculada
                    <select
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      required
                      className={inputBase}
                      disabled={companiesLoading || companyOptions.length === 0}
                    >
                      <option value="">
                        {companiesLoading ? "Carregando empresas..." : "Selecione uma empresa cadastrada"}
                      </option>
                      {companyOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    {companiesError ? (
                      <p className="text-xs font-medium text-rose-600">{companiesError}</p>
                    ) : companyOptions.length === 0 && !companiesLoading ? (
                      <p className="text-xs font-medium text-rose-600">
                        Nenhuma empresa cadastrada disponivel para selecionar.
                      </p>
                    ) : null}
                  </label>
                ) : null}

                {isCompanyAccessRequest ? (
                  <div className="space-y-4 rounded-xl border border-[#011848]/10 bg-[#f8fafc] px-4 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#011848]">Dados da empresa</p>
                      <p className="text-xs text-[#64748b]">
                        Esse perfil segue o cadastro institucional da empresa, entao os campos abaixo precisam refletir o formulario real de criacao.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={labelClass}>
                        Nome / razao social
                        <input
                          type="text"
                          value={companyDraft.companyName}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyName: event.target.value }))}
                          required
                          className={inputBase}
                          placeholder="Ex.: Testing Company LTDA"
                        />
                      </label>
                      <label className={labelClass}>
                        CNPJ
                        <input
                          type="text"
                          value={companyDraft.companyTaxId}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyTaxId: event.target.value }))}
                          className={inputBase}
                          placeholder="00.000.000/0000-00"
                        />
                      </label>
                      <label className={labelClass}>
                        CEP
                        <input
                          type="text"
                          value={companyDraft.companyZip}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyZip: event.target.value }))}
                          className={inputBase}
                          placeholder="00000-000"
                        />
                      </label>
                      <label className={labelClass}>
                        Telefone da empresa
                        <input
                          type="tel"
                          value={companyDraft.companyPhone}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyPhone: event.target.value }))}
                          className={inputBase}
                          placeholder="+55 11 4000-0000"
                        />
                      </label>
                      <label className={labelClass + " sm:col-span-2"}>
                        Endereco
                        <input
                          type="text"
                          value={companyDraft.companyAddress}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyAddress: event.target.value }))}
                          className={inputBase}
                          placeholder="Rua, numero, bairro, cidade"
                        />
                      </label>
                      <label className={labelClass}>
                        Website
                        <input
                          type="text"
                          value={companyDraft.companyWebsite}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyWebsite: event.target.value }))}
                          className={inputBase}
                          placeholder="https://empresa.com"
                        />
                      </label>
                      <label className={labelClass}>
                        LinkedIn da empresa
                        <input
                          type="text"
                          value={companyDraft.companyLinkedin}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyLinkedin: event.target.value }))}
                          className={inputBase}
                          placeholder="https://www.linkedin.com/company/..."
                        />
                      </label>
                      <label className={labelClass + " sm:col-span-2"}>
                        Descricao da empresa
                        <textarea
                          rows={3}
                          value={companyDraft.companyDescription}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyDescription: event.target.value }))}
                          className={textareaBase}
                          placeholder="Descreva rapidamente a empresa e o contexto da solicitacao."
                        />
                      </label>
                      <label className={labelClass + " sm:col-span-2"}>
                        Observacoes da empresa
                        <textarea
                          rows={3}
                          value={companyDraft.companyNotes}
                          onChange={(event) => setCompanyDraft((current) => ({ ...current, companyNotes: event.target.value }))}
                          className={textareaBase}
                          placeholder="Observacoes adicionais sobre a empresa."
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Nome completo
                    <input
                      ref={requestNameRef}
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="Ana Souza"
                    />
                  </label>
                  {isTechnicalSupportRequest ? (
                    <label className={labelClass}>
                      Usuario/login
                      <input
                        type="text"
                        value={requestedUser}
                        onChange={(event) => setRequestedUser(event.target.value)}
                        required
                        className={inputBase}
                        placeholder="login.global"
                      />
                      <p className="text-xs font-medium text-[#64748b]">
                        Obrigatorio para o perfil Suporte Tecnico.
                      </p>
                    </label>
                  ) : null}
                  <label className={labelClass}>
                    E-mail profissional
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="voce@empresa.com"
                    />
                  </label>
                  <label className={labelClass}>
                    Telefone
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="+55 11 99999-9999"
                    />
                  </label>
                </div>

                <label className={labelClass}>
                  {isCompanyAccessRequest ? "Cargo do responsavel" : "Cargo ou funcao"}
                  <div>
                    <Select value={role || EMPTY_JOB_TITLE} onValueChange={(value) => setRole(value === EMPTY_JOB_TITLE ? "" : value)}>
                      <SelectTrigger className="h-12.5 rounded-xl border-[#011848]/15 bg-white px-4 py-3 text-sm text-[#011848] focus-visible:ring-[#ef0001]/40">
                        <SelectValue placeholder="Selecione uma profissao" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        <SelectItem value={EMPTY_JOB_TITLE}>Selecione uma profissao</SelectItem>
                        {JOB_TITLE_OPTIONS.map((jobTitleOption) => (
                          <SelectItem key={jobTitleOption} value={jobTitleOption}>
                            {jobTitleOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </label>

                <label className={labelClass}>
                  Titulo da solicitacao
                  <input
                    type="text"
                    value={titulo}
                    onChange={(event) => setTitulo(event.target.value)}
                    required
                    className={inputBase}
                    placeholder="Ex: Solicito acesso ao painel de qualidade"
                  />
                </label>

                <label className={labelClass}>
                  Descricao detalhada
                  <textarea
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    required
                    rows={4}
                    className={textareaBase}
                    placeholder="Explique o contexto, a necessidade de acesso e o que precisa operar."
                  />
                </label>

                <label className={labelClass}>
                  Senha escolhida para o novo acesso
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className={inputBase}
                    placeholder="Minimo 8 caracteres"
                  />
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  title="Enviar solicitação"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-4 py-3 text-sm font-semibold text-white transition hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Enviar solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLookupOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4 ${
            styles.modalOverlay
          }`}
          onClick={() => setIsLookupOpen(false)}
          role="presentation"
        >
          <div
            className={`flex max-h-[calc(100svh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl sm:max-h-[calc(100svh-2rem)] sm:p-6 ${
              styles.modalPanel
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lookup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="lookup-title" className="text-xl font-semibold text-[#011848]">
                  Consultar solicitação
                </h3>
                <p className="text-sm text-[#475569]">
                  Informe nome e e-mail para ver o andamento e os comentários.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLookupOpen(false)}
                className="rounded-full border border-[#011848]/10 bg-white p-2 text-[#475569] transition hover:text-[#011848]"
                aria-label="Fechar modal"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <form className="space-y-4" onSubmit={handleLookup}>
                {lookupError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {lookupError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Nome completo
                    <input
                      ref={lookupNameRef}
                      type="text"
                      value={lookupName}
                      onChange={(event) => setLookupName(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="Ana Souza"
                    />
                  </label>
                  <label className={labelClass}>
                    E-mail
                    <input
                      type="email"
                      value={lookupEmail}
                      onChange={(event) => setLookupEmail(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="voce@empresa.com"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  title="Consultar solicitação"
                  disabled={lookupLoading}
                  className="flex w-full items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-4 py-3 text-sm font-semibold text-white transition hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookupLoading ? "Consultando..." : "Consultar solicitação"}
                </button>
              </form>

              {lookupItem && (
                <div className="mt-6 space-y-5 rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#011848]">Solicitação encontrada</p>
                    <p className="text-xs text-[#64748b]">
                      Criada em {new Date(lookupItem.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {typeof lookupItem.adjustmentRound === "number" && lookupItem.adjustmentRound > 0 ? (
                      <span className="rounded-full border border-[#011848]/15 bg-white px-3 py-1 text-xs font-semibold text-[#011848]">
                        {lookupItem.adjustmentRound}º ajuste
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold border ${statusTone(lookupItem.status)}`}
                    >
                      {statusLabel(lookupItem.status)}
                    </span>
                  </div>
                </div>

                  {lookupItem.status === "in_progress" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      <div className="font-semibold">Ajuste solicitado pela equipe</div>
                      <div className="mt-1 text-xs leading-5 text-amber-700">
                        Revise a orientacao recebida, compare a base original com a devolvida e corrija somente os campos destacados.
                      </div>
                      {latestLookupAdjustmentRound?.requestMessage?.trim() ? (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm text-amber-900">
                          {latestLookupAdjustmentRound.requestMessage}
                        </div>
                      ) : null}
                      {requestedLookupFields.size > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lookupAdjustmentFieldOptions
                            .filter((option) => requestedLookupFields.has(option.field))
                            .map((option) => (
                              <span
                                key={`lookup-requested-${option.field}`}
                                className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700"
                              >
                                {option.label}
                              </span>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {lookupItem.adjustmentHistory && lookupItem.adjustmentHistory.length > 0 ? (
                    <div className="rounded-xl border border-[#011848]/10 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#011848]">Histórico de ajustes</p>
                        <span className="rounded-full border border-[#011848]/10 bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#64748b]">
                          {lookupItem.adjustmentHistory.length} rodada(s)
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {[...lookupItem.adjustmentHistory].reverse().map((round) => (
                          <div key={`lookup-round-${round.round}`} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#011848]">{round.round}º ajuste</span>
                              <span className="text-xs font-medium text-[#64748b]">
                                {new Date(round.requestedAt).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#475569]">
                              {round.requestMessage?.trim() || "Sem mensagem registrada."}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {round.requestedFields.map((field) => (
                                <span
                                  key={`lookup-round-field-${round.round}-${field}`}
                                  className="inline-flex items-center rounded-full border border-[#011848]/12 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#011848]"
                                >
                                  {adjustmentFieldLabel(field, field)}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 text-xs font-medium text-[#64748b]">
                              {round.requesterReturnedAt
                                ? `Respondido em ${new Date(round.requesterReturnedAt).toLocaleString("pt-BR")}`
                                : "Aguardando resposta do solicitante."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <div className="grid items-stretch gap-4 xl:grid-cols-2">
                    <div className="flex h-full flex-col space-y-4 rounded-xl border border-[#011848]/10 bg-white px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#011848]">Base original enviada</p>
                        <p className="text-xs text-[#64748b]">
                          Referencia bloqueada para comparar o envio inicial com a versao devolvida para ajuste.
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className={labelClass}>
                          Tipo de perfil
                          <input
                            type="text"
                            readOnly
                            className={inputBase}
                            value={textOrFallback(
                              ACCESS_OPTIONS.find((option) => option.value === (lookupItem.originalRequest?.profileType ?? "testing_company_user"))?.label,
                              "Nao informado",
                            )}
                          />
                        </label>
                        <label className={labelClass}>
                          Empresa vinculada
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.company, "Sem empresa definida")} />
                        </label>
                        <label className={labelClass}>
                          Nome completo
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.fullName || lookupItem.originalRequest?.name)} />
                        </label>
                        <label className={labelClass}>
                          Usuario/login
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.username)} />
                        </label>
                        <label className={labelClass}>
                          E-mail
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.email)} />
                        </label>
                        <label className={labelClass}>
                          Telefone
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.phone)} />
                        </label>
                        <label className={labelClass}>
                          Cargo
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.jobRole)} />
                        </label>
                        <label className={labelClass}>
                          Senha informada
                          <input type="text" readOnly className={inputBase} value={lookupItem.originalRequest?.passwordHash ? "Preenchida" : "Nao informada"} />
                        </label>
                        <label className={labelClass + " sm:col-span-2"}>
                          Titulo da solicitacao
                          <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest?.title, "Sem titulo")} />
                        </label>
                        <label className={labelClass + " sm:col-span-2"}>
                          Descricao detalhada
                          <textarea readOnly rows={4} className={textareaBase} value={textOrFallback(lookupItem.originalRequest?.description)} />
                        </label>
                        <label className={labelClass + " sm:col-span-2"}>
                          Observacoes
                          <textarea readOnly rows={3} className={textareaBase} value={textOrFallback(lookupItem.originalRequest?.notes)} />
                        </label>
                      </div>

                      {lookupItem.originalRequest?.companyProfile ? (
                        <div className="rounded-xl border border-[#011848]/10 bg-[#f8fafc] px-4 py-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[#011848]">Base original da empresa</p>
                            <p className="text-xs text-[#64748b]">Dados institucionais enviados na solicitacao inicial.</p>
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <label className={labelClass}>
                              Razao social
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyName)} />
                            </label>
                            <label className={labelClass}>
                              CNPJ
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyTaxId)} />
                            </label>
                            <label className={labelClass}>
                              CEP
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyZip)} />
                            </label>
                            <label className={labelClass}>
                              Telefone da empresa
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyPhone)} />
                            </label>
                            <label className={labelClass + " sm:col-span-2"}>
                              Endereco
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyAddress)} />
                            </label>
                            <label className={labelClass}>
                              Website
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyWebsite)} />
                            </label>
                            <label className={labelClass}>
                              LinkedIn
                              <input type="text" readOnly className={inputBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyLinkedin)} />
                            </label>
                            <label className={labelClass + " sm:col-span-2"}>
                              Descricao da empresa
                              <textarea readOnly rows={3} className={textareaBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyDescription)} />
                            </label>
                            <label className={labelClass + " sm:col-span-2"}>
                              Observacoes da empresa
                              <textarea readOnly rows={3} className={textareaBase} value={textOrFallback(lookupItem.originalRequest.companyProfile.companyNotes)} />
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {lookupDraft ? (
                      <div className="flex h-full flex-col space-y-4 rounded-xl border border-[#011848]/10 bg-white px-4 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[#011848]">Ajustar dados da solicitacao</p>
                          <p className="text-xs text-[#64748b]">
                            Se a equipe pediu ajuste, corrija os dados abaixo e reenvi e a solicitacao para revisao.
                          </p>
                        </div>

                        <div className="space-y-2 text-sm font-semibold text-[#011848]">
                          <div className="flex items-center justify-between gap-3">
                            <span>Tipo de perfil</span>
                            <span className="text-right text-xs font-medium text-[#6b7280]">
                              {restrictLookupEditing ? "Editavel apenas se marcado" : "Ajuste conforme o acesso solicitado"}
                            </span>
                          </div>
                          <select
                            aria-label="Tipo de perfil"
                            value={lookupDraft.accessType}
                            onChange={(event) => {
                              const next = event.target.value as LookupDraft["accessType"];
                              setLookupDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      accessType: next,
                                      clientId: requestProfileTypeNeedsCompany(next) ? current.clientId : "",
                                      company: requestProfileTypeNeedsCompany(next) ? current.company : "",
                                    }
                                  : current,
                                );
                              }}
                            className={lookupFieldClass("profileType")}
                            disabled={!isLookupFieldEditable("profileType")}
                          >
                            {ACCESS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs font-medium text-[#64748b]">{selectedLookupAccessOption.hint}</p>
                          {requestedLookupFields.has("profileType") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                        </div>

                        {requestProfileTypeNeedsCompany(lookupDraft.accessType) ? (
                          <label className={labelClass}>
                            Empresa vinculada
                            <select
                              value={lookupDraft.clientId}
                              onChange={(event) => {
                                const nextId = event.target.value;
                                const match = companyOptions.find((item) => item.id === nextId) ?? null;
                                setLookupDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        clientId: nextId,
                                        company: match?.name?.trim() || "",
                                      }
                                    : current,
                                );
                              }}
                              className={lookupFieldClass("company")}
                              disabled={companiesLoading || companyOptions.length === 0 || !isLookupFieldEditable("company")}
                            >
                              <option value="">
                                {companiesLoading ? "Carregando empresas..." : "Selecione uma empresa cadastrada"}
                              </option>
                              {companyOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                            {requestedLookupFields.has("company") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                          </label>
                        ) : null}

                        {isLookupCompanyAccessRequest ? (
                          <div className="space-y-4 rounded-xl border border-[#011848]/10 bg-[#f8fafc] px-4 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#011848]">Dados da empresa devolvida</p>
                              <p className="text-xs text-[#64748b]">
                                Campos em vermelho sao os que a equipe devolveu para correcao nesta rodada.
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className={labelClass}>
                                Nome / razao social
                                <input
                                  type="text"
                                  value={lookupDraft.companyProfile.companyName}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyName: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyName")}
                                  readOnly={!isLookupFieldEditable("companyName")}
                                  disabled={!isLookupFieldEditable("companyName")}
                                />
                                {requestedLookupFields.has("companyName") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass}>
                                CNPJ
                                <input
                                  type="text"
                                  value={lookupDraft.companyProfile.companyTaxId}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyTaxId: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyTaxId")}
                                  readOnly={!isLookupFieldEditable("companyTaxId")}
                                  disabled={!isLookupFieldEditable("companyTaxId")}
                                />
                                {requestedLookupFields.has("companyTaxId") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass}>
                                CEP
                                <input
                                  type="text"
                                  value={lookupDraft.companyProfile.companyZip}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyZip: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyZip")}
                                  readOnly={!isLookupFieldEditable("companyZip")}
                                  disabled={!isLookupFieldEditable("companyZip")}
                                />
                                {requestedLookupFields.has("companyZip") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass}>
                                Telefone da empresa
                                <input
                                  type="tel"
                                  value={lookupDraft.companyProfile.companyPhone}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyPhone: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyPhone")}
                                  readOnly={!isLookupFieldEditable("companyPhone")}
                                  disabled={!isLookupFieldEditable("companyPhone")}
                                />
                                {requestedLookupFields.has("companyPhone") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass + " sm:col-span-2"}>
                                Endereco
                                <input
                                  type="text"
                                  value={lookupDraft.companyProfile.companyAddress}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyAddress: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyAddress")}
                                  readOnly={!isLookupFieldEditable("companyAddress")}
                                  disabled={!isLookupFieldEditable("companyAddress")}
                                />
                                {requestedLookupFields.has("companyAddress") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass}>
                                Website
                                <input
                                  type="text"
                                  value={lookupDraft.companyProfile.companyWebsite}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyWebsite: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyWebsite")}
                                  readOnly={!isLookupFieldEditable("companyWebsite")}
                                  disabled={!isLookupFieldEditable("companyWebsite")}
                                />
                                {requestedLookupFields.has("companyWebsite") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass}>
                                LinkedIn da empresa
                                <input
                                  type="text"
                                  value={lookupDraft.companyProfile.companyLinkedin}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyLinkedin: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupFieldClass("companyLinkedin")}
                                  readOnly={!isLookupFieldEditable("companyLinkedin")}
                                  disabled={!isLookupFieldEditable("companyLinkedin")}
                                />
                                {requestedLookupFields.has("companyLinkedin") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass + " sm:col-span-2"}>
                                Descricao da empresa
                                <textarea
                                  rows={3}
                                  value={lookupDraft.companyProfile.companyDescription}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyDescription: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupTextareaClass("companyDescription")}
                                  readOnly={!isLookupFieldEditable("companyDescription")}
                                  disabled={!isLookupFieldEditable("companyDescription")}
                                />
                                {requestedLookupFields.has("companyDescription") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                              <label className={labelClass + " sm:col-span-2"}>
                                Observacoes da empresa
                                <textarea
                                  rows={3}
                                  value={lookupDraft.companyProfile.companyNotes}
                                  onChange={(event) =>
                                    setLookupDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            companyProfile: { ...current.companyProfile, companyNotes: event.target.value },
                                          }
                                        : current,
                                    )
                                  }
                                  className={lookupTextareaClass("companyNotes")}
                                  readOnly={!isLookupFieldEditable("companyNotes")}
                                  disabled={!isLookupFieldEditable("companyNotes")}
                                />
                                {requestedLookupFields.has("companyNotes") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                              </label>
                            </div>
                          </div>
                        ) : null}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className={labelClass}>
                            Nome completo
                            <input
                              type="text"
                              value={lookupDraft.fullName}
                              onChange={(event) =>
                                setLookupDraft((current) => (current ? { ...current, fullName: event.target.value } : current))
                              }
                              className={lookupFieldClass("fullName")}
                              readOnly={!isLookupFieldEditable("fullName")}
                              disabled={!isLookupFieldEditable("fullName")}
                            />
                            {requestedLookupFields.has("fullName") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                          </label>
                          {isLookupTechnicalSupportRequest ? (
                            <label className={labelClass}>
                              Usuario/login
                              <input
                                type="text"
                                value={lookupDraft.user}
                                onChange={(event) =>
                                  setLookupDraft((current) => (current ? { ...current, user: event.target.value } : current))
                                }
                                className={lookupFieldClass("username")}
                                placeholder="login.global"
                                readOnly={!isLookupFieldEditable("username")}
                                disabled={!isLookupFieldEditable("username")}
                              />
                              {requestedLookupFields.has("username") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                            </label>
                          ) : null}
                          <label className={labelClass}>
                            E-mail profissional
                            <input
                              type="email"
                              value={lookupDraft.email}
                              onChange={(event) =>
                                setLookupDraft((current) => (current ? { ...current, email: event.target.value } : current))
                              }
                              className={lookupFieldClass("email")}
                              readOnly={!isLookupFieldEditable("email")}
                              disabled={!isLookupFieldEditable("email")}
                            />
                            {requestedLookupFields.has("email") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                          </label>
                          <label className={labelClass}>
                            Telefone
                            <input
                              type="tel"
                              value={lookupDraft.phone}
                              onChange={(event) =>
                                setLookupDraft((current) => (current ? { ...current, phone: event.target.value } : current))
                              }
                              className={lookupFieldClass("phone")}
                              readOnly={!isLookupFieldEditable("phone")}
                              disabled={!isLookupFieldEditable("phone")}
                            />
                            {requestedLookupFields.has("phone") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                          </label>
                          <label className={labelClass}>
                            {isLookupCompanyAccessRequest ? "Cargo do responsavel" : "Cargo ou funcao"}
                            <div>
                              <Select
                                value={lookupDraft.role || EMPTY_JOB_TITLE}
                                onValueChange={(value) =>
                                  setLookupDraft((current) =>
                                    current ? { ...current, role: value === EMPTY_JOB_TITLE ? "" : value } : current,
                                  )
                                }
                                disabled={!isLookupFieldEditable("jobRole")}
                              >
                                <SelectTrigger className={`h-12.5 rounded-xl px-4 py-3 text-sm text-[#011848] focus-visible:ring-[#ef0001]/40 ${requestedLookupFields.has("jobRole") ? "border-rose-300 bg-rose-50 text-rose-700" : "border-[#011848]/15 bg-white"}`}>
                                  <SelectValue placeholder="Selecione uma profissao" />
                                </SelectTrigger>
                                <SelectContent className="max-h-80">
                                  <SelectItem value={EMPTY_JOB_TITLE}>Selecione uma profissao</SelectItem>
                                  {JOB_TITLE_OPTIONS.map((jobTitleOption) => (
                                    <SelectItem key={jobTitleOption} value={jobTitleOption}>
                                      {jobTitleOption}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {requestedLookupFields.has("jobRole") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                          </label>
                        </div>

                        <label className={labelClass}>
                          Titulo da solicitacao
                          <input
                            type="text"
                            value={lookupDraft.title}
                            onChange={(event) =>
                              setLookupDraft((current) => (current ? { ...current, title: event.target.value } : current))
                            }
                            className={lookupFieldClass("title")}
                            readOnly={!isLookupFieldEditable("title")}
                            disabled={!isLookupFieldEditable("title")}
                          />
                          {requestedLookupFields.has("title") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                        </label>

                        <label className={labelClass}>
                          Descricao detalhada
                          <textarea
                            rows={4}
                            value={lookupDraft.description}
                            onChange={(event) =>
                              setLookupDraft((current) => (current ? { ...current, description: event.target.value } : current))
                            }
                            className={lookupTextareaClass("description")}
                            readOnly={!isLookupFieldEditable("description")}
                            disabled={!isLookupFieldEditable("description")}
                          />
                          {requestedLookupFields.has("description") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                        </label>

                        <label className={labelClass}>
                          Observacoes
                          <textarea
                            rows={3}
                            value={lookupDraft.notes}
                            onChange={(event) =>
                              setLookupDraft((current) => (current ? { ...current, notes: event.target.value } : current))
                            }
                            className={lookupTextareaClass("notes")}
                            readOnly={!isLookupFieldEditable("notes")}
                            disabled={!isLookupFieldEditable("notes")}
                          />
                          {requestedLookupFields.has("notes") ? <p className="text-xs font-semibold text-rose-600">Corrija este campo.</p> : null}
                        </label>

                        <label className={labelClass}>
                          Nova senha
                          <input
                            type="password"
                            value={lookupDraft.password}
                            onChange={(event) =>
                              setLookupDraft((current) => (current ? { ...current, password: event.target.value } : current))
                            }
                            className={lookupFieldClass("password")}
                            placeholder="Deixe em branco para manter a senha atual"
                            readOnly={!isLookupFieldEditable("password")}
                            disabled={!isLookupFieldEditable("password")}
                          />
                          <p className="text-xs font-medium text-[#64748b]">
                            {requestedLookupFields.has("password")
                              ? "Corrija este campo."
                              : "Se quiser trocar a senha informada na solicitacao, preencha aqui."}
                          </p>
                        </label>

                        {canEditLookup ? (
                          <button
                            type="button"
                            onClick={() => void handleUpdateLookup()}
                            disabled={lookupSaving}
                            className="flex w-full items-center justify-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] px-4 py-3 text-sm font-semibold text-white transition hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/60 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {lookupSaving ? "Enviando..." : lookupItem.status === "in_progress" ? "Enviar ajuste" : "Atualizar solicitacao"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[#011848]">Conversa e justificativas</p>
                      <p className="text-xs text-[#64748b]">
                        A mensagem do admin explica o ajuste. Sua resposta fica registrada como conversa e nao altera os campos automaticamente.
                      </p>
                    </div>
                    <div className="comments-chat">
                      <div className="comments-chat-list" aria-live="polite">
                        {timelineEntries.length === 0 ? (
                          <p className="comments-chat-empty">Nenhum comentário ainda.</p>
                        ) : (
                          timelineEntries.map((entry) => {
                            const mine = entry.authorRole === "requester";
                            return (
                              <div
                                key={entry.id}
                                className={`comments-chat-message ${mine ? "mine" : "other"}`}
                              >
                                <div className="comments-chat-author">
                                  {entry.authorRole === "admin" ? "Admin" : "Solicitante"}: {entry.authorName}
                                </div>
                                <div className="comments-chat-bubble whitespace-pre-wrap">{entry.body}</div>
                                <div className="comments-chat-meta">
                                  {new Date(entry.createdAt).toLocaleString("pt-BR")}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="comments-chat-input">
                        <textarea
                          className={textareaBase}
                          rows={3}
                          placeholder={
                            lookupItem.status === "closed" || lookupItem.status === "rejected"
                              ? "Solicitacao finalizada"
                              : "Adicionar comentario"
                          }
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          disabled={lookupItem.status === "closed" || lookupItem.status === "rejected"}
                        />
                        <div className="comments-chat-actions">
                          <button
                            type="button"
                            onClick={handleSubmitComment}
                            disabled={
                              commentSubmitting ||
                              !commentDraft.trim() ||
                              lookupItem.status === "closed" ||
                              lookupItem.status === "rejected"
                            }
                            title="Enviar comentário"
                            className="rounded-xl border border-[#011848]/15 bg-white px-4 py-2 text-xs font-semibold text-[#011848] transition hover:bg-[#011848]/5 disabled:opacity-60"
                          >
                            {commentSubmitting ? "Enviando..." : "Enviar comentário"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
