"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSWRProfileSummary } from "./useSWRProfileSummary";
import { useSWRCompanies } from "./useSWRCompanies";
import Link from "next/link";
import { FiAlertCircle, FiCheckCircle, FiChevronDown, FiSearch, FiTrash2 } from "react-icons/fi";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { publishAuthUser, useAuthUser } from "@/hooks/useAuthUser";
import { useAppSettings, type Language, type Theme } from "@/context/AppSettingsContext";
import { JOB_TITLE_OPTIONS } from "@/lib/jobTitles";
import { fetchApi } from "@/lib/api";

type LinkedCompany = {
  client_id: string;
  client_name: string;
  client_slug: string;
  client_active: boolean;
  role: "ADMIN" | "USER";
  link_active: boolean;
};

type UsernameReplacementDialogState = {
  mode: "generate" | "submit";
  currentUsername: string;
  nextUsername: string;
};

type AvatarSource = "upload" | "url" | null;

type ProfileSummary = {
  openDefectsCount: number;
  notesCreatedCount: number;
  linkedCompaniesCount: number;
  createdAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeCompanies(payload: unknown): LinkedCompany[] {
  const rec = asRecord(payload);
  const items = Array.isArray(rec?.items) ? (rec.items as unknown[]) : [];

  return items
    .map((row) => {
      const current = asRecord(row) ?? {};
      const role: LinkedCompany["role"] = current.role === "ADMIN" ? "ADMIN" : "USER";
      return {
        client_id: typeof current.client_id === "string" ? current.client_id : "",
        client_name: typeof current.client_name === "string" ? current.client_name : "",
        client_slug: typeof current.client_slug === "string" ? current.client_slug : "",
        client_active: current.client_active === true,
        role,
        link_active: current.link_active === true,
      };
    })
    .filter((company) => company.client_id && company.client_name && company.client_slug);
}

function normalizeUiRole(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "it_dev" || normalized === "dev" || normalized === "developer") return "global";
  if (normalized === "admin" || normalized === "global_admin") return "admin";
  if (normalized === "company" || normalized === "company_admin" || normalized === "client_admin") return "empresa";
  return "usuario";
}

function roleLabel(value?: string | null) {
  const normalized = normalizeUiRole(value);
  if (normalized === "global") return "Global";
  if (normalized === "admin") return "Admin";
  if (normalized === "empresa") return "Empresa";
  return "Usuario";
}

function statusLabel(active?: boolean, status?: string | null) {
  if (active === false || status === "inactive" || status === "blocked") return "Inativo";
  if (status === "invited") return "Convidado";
  return "Ativo";
}

function suggestUsername(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "usuario";
}

function normalizeSearchTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function jobTitleMatchScore(option: string, query: string) {
  if (!query) return 0;

  const normalizedOption = normalizeSearchTerm(option);
  if (normalizedOption === query) return 5;
  if (normalizedOption.startsWith(query)) return 4;
  if (normalizedOption.split(/[\s/-]+/).some((token) => token.startsWith(query))) return 3;
  if (normalizedOption.includes(query)) return 2;
  return -1;
}

function normalizeProfileSummary(payload: unknown): ProfileSummary {
  const record = asRecord(payload) ?? {};
  return {
    openDefectsCount:
      typeof record.openDefectsCount === "number" && Number.isFinite(record.openDefectsCount) ? record.openDefectsCount : 0,
    notesCreatedCount:
      typeof record.notesCreatedCount === "number" && Number.isFinite(record.notesCreatedCount) ? record.notesCreatedCount : 0,
    linkedCompaniesCount:
      typeof record.linkedCompaniesCount === "number" && Number.isFinite(record.linkedCompaniesCount) ? record.linkedCompaniesCount : 0,
    createdAt: typeof record.createdAt === "string" && record.createdAt.trim() ? record.createdAt : null,
  };
}

function formatMetricDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return parsed.toLocaleDateString("pt-BR");
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary)">
      <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent) dark:text-[#ff8a8a]">{label}</span>
      {children}
    </label>
  );
}

function FieldHint({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "strong";
}) {
  return (
    <div
      className={
        tone === "strong"
          ? "text-[12px] font-semibold text-(--tc-accent) dark:text-[#ff8a8a]"
          : "text-[12px] font-medium text-(--tc-accent) dark:text-[#ff8a8a]"
      }
    >
      {children}
    </div>
  );
}

function Feedback({
  message,
  tone,
}: {
  message: string | null;
  tone: "error" | "success";
}) {
  if (!message) return null;

  const isError = tone === "error";
  const Icon = isError ? FiAlertCircle : FiCheckCircle;
  const title = isError ? "Erro" : "Sucesso";
  const className = isError
    ? "border-2 border-rose-500 bg-rose-100/95 text-rose-950 shadow-[0_10px_28px_rgba(190,24,93,0.16)] dark:border-rose-300 dark:bg-rose-950/72 dark:text-rose-50"
    : "border-2 border-emerald-500 bg-emerald-100/95 text-emerald-950 shadow-[0_10px_28px_rgba(5,150,105,0.16)] dark:border-emerald-300 dark:bg-emerald-950/72 dark:text-emerald-50";
  const iconWrapClass = isError
    ? "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950"
    : "bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-[18px] ${className}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${iconWrapClass}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] opacity-90">{title}</p>
          <p className="mt-1 text-[14px] font-semibold leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}

function extractApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) return nested.message.trim();
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  return null;
}

const LOCAL_AVATAR_PREFIX = "/api/s3/object?key=";

function isLocalAvatarUrl(value?: string | null) {
  return typeof value === "string" && value.startsWith(LOCAL_AVATAR_PREFIX);
}

function resolveAvatarSource(value?: string | null): AvatarSource {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  return isLocalAvatarUrl(normalized) ? "upload" : "url";
}

function isBlobAvatarUrl(value?: string | null) {
  return typeof value === "string" && value.startsWith("blob:");
}

function PanelHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-(--tc-border) pb-4">
      <h2 className="text-[1.2rem] font-semibold tracking-[-0.02em] text-(--tc-text-primary)">{title}</h2>
      {description ? <p className="mt-1 text-sm font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">{description}</p> : null}
    </div>
  );
}

function PanelSectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-bold text-(--tc-text-primary)">{title}</h3>
      {description ? <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">{description}</p> : null}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/14 bg-white/8 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">{label}</div>
      <div className="mt-2 min-h-10 text-[1.75rem] leading-[1.02] font-extrabold text-white sm:text-[1.95rem]" title={value}>
        {value}
      </div>
      {note ? <div className="mt-1 text-xs font-medium text-white/72">{note}</div> : null}
    </div>
  );
}

const pageShellClass = "tc-page-shell px-2 py-4 sm:px-4 lg:px-6 xl:px-8 2xl:px-10";
const heroClass = "tc-hero-panel";
const surfaceClass = "tc-panel";
const primaryButtonClass = "tc-button-primary";
const secondaryButtonClass = "tc-button-secondary";
const dangerButtonClass = "tc-button-danger";
const inputClass =
  "h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 text-base font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]";
const selectInputClass =
  "h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 py-3 text-sm font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]";

function statusPillClass(tone: "neutral" | "positive" | "warning") {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200";
  return "border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary)";
}

export default function SettingsProfilePage() {
  const { user, loading, refreshUser } = useAuthUser();
  const { theme, language, setTheme, setLanguage, saveSettings, loading: settingsLoading } = useAppSettings();
  const [companies, setCompanies] = useState<LinkedCompany[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileFullName, setProfileFullName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileJobTitle, setProfileJobTitle] = useState("");
  const [profileLinkedinUrl, setProfileLinkedinUrl] = useState("");
  const [profileAvatarUrlInput, setProfileAvatarUrlInput] = useState("");
  const [profileUploadedAvatarUrl, setProfileUploadedAvatarUrl] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarSource, setProfileAvatarSource] = useState<AvatarSource>(null);
  const [profileAvatarDirty, setProfileAvatarDirty] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [profileSummaryLoading, setProfileSummaryLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [generatingUsername, setGeneratingUsername] = useState(false);
  const [generatedUsernameHistory, setGeneratedUsernameHistory] = useState<string[]>([]);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [deleteUserSuccess, setDeleteUserSuccess] = useState<string | null>(null);
  const [deleteUserConfirmOpen, setDeleteUserConfirmOpen] = useState(false);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [deleteRequestReason, setDeleteRequestReason] = useState("");
  const [deleteRequestLoading, setDeleteRequestLoading] = useState(false);
  const [deleteRequestError, setDeleteRequestError] = useState<string | null>(null);
  const [deleteRequestSuccess, setDeleteRequestSuccess] = useState<string | null>(null);
  const [usernameReplacementDialog, setUsernameReplacementDialog] = useState<UsernameReplacementDialogState | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const jobTitleFieldRef = useRef<HTMLDivElement | null>(null);
  const [jobTitleMenuOpen, setJobTitleMenuOpen] = useState(false);

  const userRecord = asRecord(user);
  const fullName =
    (typeof userRecord?.fullName === "string" ? userRecord.fullName : "") ||
    (typeof userRecord?.full_name === "string" ? String(userRecord.full_name) : "");
  const name = (typeof userRecord?.name === "string" ? userRecord.name : "") || "";
  const email = (typeof userRecord?.email === "string" ? userRecord.email : "") || "";
  const username =
    (typeof userRecord?.username === "string" ? userRecord.username : "") ||
    (typeof userRecord?.user === "string" ? String(userRecord.user) : "") ||
    email;
  const phone = (typeof userRecord?.phone === "string" ? userRecord.phone : "") || "";
  const jobTitle =
    (typeof userRecord?.jobTitle === "string" ? userRecord.jobTitle : "") ||
    (typeof userRecord?.job_title === "string" ? String(userRecord.job_title) : "") ||
    "";
  const linkedinUrl =
    (typeof userRecord?.linkedinUrl === "string" ? userRecord.linkedinUrl : "") ||
    (typeof userRecord?.linkedin_url === "string" ? String(userRecord.linkedin_url) : "") ||
    "";
  const avatarUrl = (typeof userRecord?.avatarUrl === "string" ? userRecord.avatarUrl : "") || "";
  const active = typeof userRecord?.active === "boolean" ? userRecord.active : true;
  const status = typeof userRecord?.status === "string" ? userRecord.status : null;
  const roleValue =
    (typeof userRecord?.permissionRole === "string" ? userRecord.permissionRole : "") ||
    (typeof userRecord?.role === "string" ? userRecord.role : "") ||
    (typeof userRecord?.companyRole === "string" ? String(userRecord.companyRole) : "");
  const currentClientSlug = (typeof userRecord?.clientSlug === "string" ? userRecord.clientSlug : null) ?? null;
  const isGlobalProfile = normalizeUiRole(roleValue) === "global";
  const isAdminProfile = normalizeUiRole(roleValue) === "admin";
  const canDeleteDirectly = isGlobalProfile || isAdminProfile;
  const hasCompanyContext = !isGlobalProfile && !isAdminProfile;
  const uiRoleLabel = roleLabel(roleValue);
  const userStatusLabel = statusLabel(active, status);
  const directDeleteModalTitle = isGlobalProfile ? "Deletar perfil de suporte tecnico" : "Deletar perfil administrativo";
  const directDeleteModalDescription = `Voce vai remover permanentemente este perfil ${uiRoleLabel.toLowerCase()} da plataforma. O acesso sera encerrado imediatamente e a conta deixara de funcionar apos a confirmacao.`;

  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, LinkedCompany>();
    for (const company of companies) {
      map.set(company.client_id, company);
    }
    return Array.from(map.values());
  }, [companies]);

  const heroName = profileFullName.trim() || fullName || name || "Usuario";
  const heroUsername = profileUsername.trim() || username || "usuario";
  const persistedAvatarUrl = avatarUrl.trim();
  const activeAvatarUrl = (() => {
    if (profileAvatarSource === "upload") return profileUploadedAvatarUrl.trim();
    if (profileAvatarSource === "url") return profileAvatarUrlInput.trim();
    return "";
  })();
  const previewAvatarUrl = profileAvatarDirty ? activeAvatarUrl : persistedAvatarUrl;
  const heroAvatarUrl = persistedAvatarUrl;
  const avatarLoadingPlaceholder = loading && !persistedAvatarUrl && !profileAvatarDirty;
  const generatedUsernameHint = useMemo(
    () => suggestUsername(profileFullName.trim() || profileEmail.trim() || heroName),
    [heroName, profileEmail, profileFullName],
  );
  const filteredJobTitleOptions = useMemo(() => {
    const query = normalizeSearchTerm(profileJobTitle);
    return [...JOB_TITLE_OPTIONS]
      .map((option) => ({ option, score: jobTitleMatchScore(option, query) }))
      .filter(({ score }) => (query ? score >= 0 : true))
      .sort((left, right) => right.score - left.score || left.option.localeCompare(right.option, "pt-BR"))
      .map(({ option }) => option);
  }, [profileJobTitle]);
  const persistedUsername = useMemo(
    () => (
      (typeof user?.username === "string" ? user.username : "") ||
      (typeof user?.user === "string" ? user.user : "") ||
      username ||
      ""
    ).trim().toLowerCase(),
    [user?.user, user?.username, username],
  );
  const openDefectsMetricValue =
    profileSummaryLoading && !profileSummary ? "--" : String(profileSummary?.openDefectsCount ?? 0);
  const notesCreatedMetricValue =
    profileSummaryLoading && !profileSummary ? "--" : String(profileSummary?.notesCreatedCount ?? 0);
  const createdAtMetricValue =
    profileSummaryLoading && !profileSummary ? "--" : formatMetricDate(profileSummary?.createdAt ?? null);
  const linkedCompaniesMetricValue =
    profileSummaryLoading && !profileSummary
      ? "--"
      : String(profileSummary?.linkedCompaniesCount ?? uniqueCompanies.length);

  const { companies, loading: companiesLoading, error: companiesError, refetch: refetchCompanies } = useSWRCompanies(hasCompanyContext);
  useEffect(() => {
    if (companies) setCompanies(normalizeCompanies(companies));
    if (companiesError) setCompaniesError(companiesError.message || String(companiesError));
  }, [companies, companiesError]);

  const { profileSummary, loading: profileSummaryLoading, error: profileSummaryError, refetch: refetchProfileSummary } = useSWRProfileSummary(user?.id);
  useEffect(() => {
    if (profileSummary) setProfileSummary(normalizeProfileSummary(profileSummary));
    if (profileSummaryError) setProfileSummary(null);
    setProfileSummaryLoading(profileSummaryLoading);
  }, [profileSummary, profileSummaryError, profileSummaryLoading]);

  useEffect(() => {
    setProfileFullName(fullName || "");
    setProfileUsername(username || "");
    setProfileEmail(email || "");
    setProfilePhone(phone || "");
    setProfileJobTitle(jobTitle || "");
    setProfileLinkedinUrl(linkedinUrl || "");
    const nextAvatarUrl = avatarUrl || "";
    const nextSource = resolveAvatarSource(nextAvatarUrl);
    setProfileAvatarFile(null);
    setProfileAvatarDirty(false);
    setGeneratedUsernameHistory([]);
    setProfileAvatarSource(nextSource);
    setProfileUploadedAvatarUrl(nextSource === "upload" ? nextAvatarUrl : "");
    setProfileAvatarUrlInput(nextSource === "url" ? nextAvatarUrl : "");
  }, [avatarUrl, email, fullName, jobTitle, linkedinUrl, phone, username]);

  useEffect(() => {
    if (!jobTitleMenuOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!jobTitleFieldRef.current?.contains(event.target as Node)) {
        setJobTitleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [jobTitleMenuOpen]);

  useEffect(() => {
    return () => {
      if (isBlobAvatarUrl(profileUploadedAvatarUrl)) {
        URL.revokeObjectURL(profileUploadedAvatarUrl);
      }
    };
  }, [profileUploadedAvatarUrl]);

  async function fetchUniqueUsernameCandidate() {
    const seed = profileFullName.trim() || profileEmail.trim() || heroName;
    const avoid = Array.from(
      new Set(
        [persistedUsername, profileUsername.trim().toLowerCase(), ...generatedUsernameHistory]
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    setGeneratingUsername(true);
    try {
      const response = await fetchApi("/api/me/username-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, avoid }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileError(extractApiError(payload) || "Nao foi possivel gerar um novo login.");
        return null;
      }
      const generated =
        payload && typeof payload === "object" && typeof (payload as { username?: unknown }).username === "string"
          ? ((payload as { username?: string }).username ?? "").trim().toLowerCase()
          : "";
      if (!generated) {
        setProfileError("Nao foi possivel gerar um novo login.");
        return null;
      }
      setGeneratedUsernameHistory((current) => (current.includes(generated) ? current : [...current, generated]));
      return generated;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Nao foi possivel gerar um novo login.");
      return null;
    } finally {
      setGeneratingUsername(false);
    }
  }

  async function requestGeneratedUsername() {
    setProfileError(null);
    const generated = await fetchUniqueUsernameCandidate();
    if (!generated) return;
    const currentEffectiveUsername = profileUsername.trim().toLowerCase() || persistedUsername;

    if (currentEffectiveUsername && generated && currentEffectiveUsername !== generated) {
      setUsernameReplacementDialog({
        mode: "generate",
        currentUsername: currentEffectiveUsername,
        nextUsername: generated,
      });
      return;
    }

    setProfileUsername(generated);
  }

  async function submitProfileChanges(options?: { allowGeneratedReplacement?: boolean; forcedGeneratedUsername?: string }) {
    setProfileError(null);
    setProfileSuccess(null);

    const nextFullName = profileFullName.trim();
    const typedUsername = profileUsername.trim().toLowerCase();
    const nextUsername = (options?.forcedGeneratedUsername ?? typedUsername).trim().toLowerCase();
    const nextEmail = profileEmail.trim();
    const nextPhone = profilePhone.trim();
    const nextJobTitle = profileJobTitle.trim();
    const nextLinkedinUrl = profileLinkedinUrl.trim();
    let nextAvatarUrl = activeAvatarUrl.trim();

    if (!nextFullName) {
      setProfileError("Informe nome completo.");
      return;
    }
    if (!nextEmail) {
      setProfileError("Informe o e-mail do usuario.");
      return;
    }
    if (!options?.allowGeneratedReplacement && !nextUsername && persistedUsername) {
      const generatedUsername = await fetchUniqueUsernameCandidate();
      if (!generatedUsername) return;
      setUsernameReplacementDialog({
        mode: "submit",
        currentUsername: persistedUsername,
        nextUsername: generatedUsername,
      });
      return;
    }

    setProfileLoading(true);
    try {
      setUsernameReplacementDialog(null);
      let resolvedUsernameAfterSave = nextUsername;
      if (profileAvatarSource === "upload" && profileAvatarFile) {
        setAvatarUploading(true);

        const form = new FormData();
        form.append("file", profileAvatarFile);

        const avatarResponse = await fetch("/api/me/avatar", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const avatarPayload = await avatarResponse.json().catch(() => ({}));

        if (!avatarResponse.ok) {
          setProfileError(extractApiError(avatarPayload) || "Nao foi possivel enviar a foto.");
          return;
        }

        nextAvatarUrl =
          avatarPayload && typeof avatarPayload === "object" && typeof (avatarPayload as { avatarUrl?: unknown }).avatarUrl === "string"
            ? ((avatarPayload as { avatarUrl?: string }).avatarUrl ?? "").trim()
            : "";

        setProfileUploadedAvatarUrl(nextAvatarUrl);
        setProfileAvatarFile(null);
        setProfileAvatarDirty(false);
      }

      const response = await fetchApi("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: nextFullName,
          name: nextFullName,
          user: nextUsername,
          email: nextEmail,
          phone: nextPhone,
          job_title: nextJobTitle || null,
          linkedin_url: nextLinkedinUrl || null,
          avatar_url: nextAvatarUrl || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileError(extractApiError(payload) || `Nao foi possivel atualizar os dados (${response.status}).`);
        return;
      }

      if (payload && typeof payload === "object" && "user" in payload) {
        const updatedUser = (payload as { user?: Record<string, unknown> | null }).user ?? null;
        if (updatedUser) {
          const resolvedUsername =
            (typeof updatedUser.username === "string" ? updatedUser.username : "") ||
            (typeof updatedUser.user === "string" ? updatedUser.user : "");
          if (resolvedUsername) {
            resolvedUsernameAfterSave = resolvedUsername;
            setProfileUsername(resolvedUsername);
          }
        }
      }

      const settingsResult = await saveSettings({ theme, language });
      if (!settingsResult.ok) {
        setProfileError("Nao foi possivel salvar as preferencias.");
        return;
      }

      await refreshUser();
      setProfileAvatarDirty(false);
      const generatedOnSave = !typedUsername && !!resolvedUsernameAfterSave;
      setProfileSuccess(
        generatedOnSave
          ? `Dados e preferencias atualizados com sucesso. Usuario gerado: @${resolvedUsernameAfterSave}.`
          : "Dados e preferencias atualizados com sucesso.",
      );
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Nao foi possivel atualizar os dados.");
    } finally {
      setAvatarUploading(false);
      setProfileLoading(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitProfileChanges();
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordError("Informe a senha atual e a nova senha.");
      return;
    }
    if (newPassword.trim().length < 8) {
      setPasswordError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As novas senhas nao conferem.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("A nova senha deve ser diferente da atual.");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetchApi("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPasswordError(extractApiError(payload) || `Nao foi possivel atualizar a senha (${response.status}).`);
        return;
      }

      setPasswordSuccess("Senha atualizada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Nao foi possivel atualizar a senha.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteUser() {
    setDeleteUserError(null);
    setDeleteUserSuccess(null);

    setDeleteUserLoading(true);
    try {
      const response = await fetchApi("/api/me", {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setDeleteUserError(typeof payload?.error === "string" ? payload.error : "Erro ao deletar usuario.");
        return;
      }

      setDeleteUserSuccess("Usuario deletado com sucesso. Redirecionando...");
      publishAuthUser(null);
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);
      window.setTimeout(() => {
        window.location.href = "/login";
      }, 1800);
    } catch (error) {
      setDeleteUserError(error instanceof Error ? error.message : "Erro ao deletar usuario.");
    } finally {
      setDeleteUserLoading(false);
    }
  }

  async function handleProfileDeletionRequest() {
    setDeleteRequestError(null);
    setDeleteRequestSuccess(null);

    const reason = deleteRequestReason.trim();
    if (!reason) {
      setDeleteRequestError("Descreva o motivo da exclusao do perfil.");
      return;
    }

    setDeleteRequestLoading(true);
    try {
      const response = await fetchApi("/api/requests/profile-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteRequestError(extractApiError(payload) || "Nao foi possivel enviar a solicitacao.");
        return;
      }

      setDeleteRequestSuccess("Solicitacao enviada para analise.");
      setDeleteRequestOpen(false);
      setDeleteRequestReason("");
    } catch (error) {
      setDeleteRequestError(error instanceof Error ? error.message : "Nao foi possivel enviar a solicitacao.");
    } finally {
      setDeleteRequestLoading(false);
    }
  }

  async function handleAvatarUpload(file?: File) {
    if (!file) return;

    setProfileError(null);
    setProfileSuccess(null);
    const previewUrl = URL.createObjectURL(file);
    setProfileAvatarFile(file);
    setProfileAvatarSource("upload");
    setProfileUploadedAvatarUrl(previewUrl);
    setProfileAvatarUrlInput("");
    setProfileAvatarDirty(true);
    setProfileSuccess("Foto pronta para salvar.");

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className={pageShellClass}>
        <Breadcrumb items={[{ label: "Conta" }, { label: "Meu perfil" }]} />

        <section className={heroClass}>
          <div className="space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <UserAvatar
                  src={heroAvatarUrl || null}
                  name={heroName}
                  showFallback={!avatarLoadingPlaceholder}
                  size="lg"
                  editable
                  onEdit={() => avatarInputRef.current?.click()}
                  className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
                  frameClassName={heroAvatarUrl ? "border-0 bg-transparent ring-0 shadow-[0_16px_34px_rgba(1,24,72,0.22)]" : "border border-white/28 bg-white/10 text-white shadow-[0_16px_34px_rgba(1,24,72,0.18)]"}
                  fallbackClassName="text-xl font-bold tracking-[0.18em] text-white"
                  buttonClassName="bg-(--tc-primary) text-white hover:bg-(--tc-accent)"
                />

                <div className="min-w-0 space-y-3">
                  <div className="space-y-2">
                    <p className="tc-hero-kicker">Minha conta</p>
                    <h1 className="tc-hero-title">{heroName}</h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-sm text-white/82">
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/92">
                      @{heroUsername}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/92">
                      {uiRoleLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/92">
                      {userStatusLabel}
                    </span>
                    {(profileEmail.trim() || email) ? (
                      <span className="truncate font-medium text-white/76">{profileEmail.trim() || email}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {currentClientSlug ? (
                <div className="tc-hero-actions">
                  <Link
                    href={`/empresas/${encodeURIComponent(currentClientSlug)}/home`}
                    className="inline-flex h-10 items-center rounded-lg border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    Abrir empresa
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric label="Defeitos abertos" value={openDefectsMetricValue} note="Criados por voce" />
              <HeroMetric label="Notas criadas" value={notesCreatedMetricValue} note="Notas pessoais" />
              <HeroMetric label="Conta criada" value={createdAtMetricValue} note="Cadastro do usuario" />
              <HeroMetric label="Vinculos ativos" value={linkedCompaniesMetricValue} note="Empresas no cadastro" />
            </div>
          </div>
        </section>

        <form className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]" onSubmit={handleProfileSubmit}>
          <section className={`${surfaceClass} space-y-6`}>
            <PanelHeader title="Cadastro do usuario" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo">
                <input
                  className={`form-control-user ${inputClass}`}
                  value={profileFullName}
                  onChange={(event) => setProfileFullName(event.target.value)}
                  disabled={profileLoading || loading}
                  title="Nome completo"
                  placeholder="Ex.: Maria Silva"
                  required
                />
              </Field>

              <Field label="Usuario (login)">
                <div className="space-y-2">
                  <input
                    className={`form-control-user ${inputClass}`}
                    value={profileUsername}
                    onChange={(event) => setProfileUsername(event.target.value)}
                    disabled={profileLoading || loading}
                    placeholder={`Ex.: ${generatedUsernameHint}`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#0b1f52] dark:text-[#d7e5ff]">
                    <FieldHint tone="strong">Unico no sistema. Em branco, gera automaticamente.</FieldHint>
                    <button
                      type="button"
                      className="rounded-full border border-[#0b1f52] bg-[#0b1f52] px-3 py-1 font-semibold text-white transition hover:border-(--tc-accent) hover:bg-(--tc-accent) hover:text-white disabled:opacity-60 dark:border-[#0b1f52] dark:bg-[#0b1f52] dark:text-white dark:hover:border-(--tc-accent) dark:hover:bg-(--tc-accent) dark:hover:text-white"
                      onClick={() => void requestGeneratedUsername()}
                      disabled={profileLoading || loading || generatingUsername}
                    >
                      {generatingUsername ? "Gerando..." : "Gerar login"}
                    </button>
                  </div>
                </div>
              </Field>

              <Field label="E-mail">
                <input
                  type="email"
                  className={`form-control-user ${inputClass}`}
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  disabled={profileLoading || loading}
                  title="E-mail"
                  placeholder="seu@email.com"
                  required
                />
              </Field>

              <Field label="Telefone">
                <input
                  className={`form-control-user ${inputClass}`}
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  disabled={profileLoading || loading}
                  placeholder="+55 11 99999-9999"
                />
              </Field>
            </div>

            <div className="space-y-4 border-t border-(--tc-border) pt-6">
              <PanelSectionTitle title="Profissional" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Cargo">
                  <div ref={jobTitleFieldRef} className="relative space-y-4">
                    <div className="relative">
                      <FiSearch
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#0b1f52] dark:text-[#d7e5ff]"
                        size={16}
                      />
                      <input
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={jobTitleMenuOpen}
                        aria-controls="job-title-suggestions"
                        autoComplete="off"
                        className={`form-control-user ${inputClass} pl-11 pr-12`}
                        value={profileJobTitle}
                        onChange={(event) => {
                          setProfileJobTitle(event.target.value);
                          setJobTitleMenuOpen(true);
                        }}
                        onFocus={() => setJobTitleMenuOpen(true)}
                        onClick={() => setJobTitleMenuOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setJobTitleMenuOpen(false);
                          }
                        }}
                        disabled={profileLoading || loading}
                        placeholder="Busque ou escolha um cargo"
                      />
                      <button
                        type="button"
                        aria-label={jobTitleMenuOpen ? "Fechar lista de cargos" : "Abrir lista de cargos"}
                        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#0b1f52] transition hover:bg-rose-50 hover:text-(--tc-accent) dark:text-[#d7e5ff] dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                        onClick={() => setJobTitleMenuOpen((current) => !current)}
                        disabled={profileLoading || loading}
                      >
                        <FiChevronDown className={`transition ${jobTitleMenuOpen ? "rotate-180" : ""}`} size={18} />
                      </button>
                    </div>

                    {jobTitleMenuOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 overflow-hidden rounded-[20px] border border-[#7b92bc] bg-white shadow-[0_18px_46px_rgba(15,23,42,0.18)] dark:border-[#7b92bc] dark:bg-white">
                        <div className="border-b border-[#d7e0ef] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent) dark:border-[#d7e0ef] dark:text-(--tc-accent)">
                          {profileJobTitle.trim()
                            ? `${filteredJobTitleOptions.length} sugestoes encontradas`
                            : `${JOB_TITLE_OPTIONS.length} cargos conhecidos`}
                        </div>
                        <div id="job-title-suggestions" role="listbox" className="max-h-72 overflow-y-auto py-2">
                          {filteredJobTitleOptions.length > 0 ? (
                            filteredJobTitleOptions.map((jobTitleOption) => {
                              const isSelected = normalizeSearchTerm(jobTitleOption) === normalizeSearchTerm(profileJobTitle);
                              return (
                                <button
                                  key={jobTitleOption}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                                    isSelected
                                      ? "bg-rose-50 text-[#0b1f52] dark:bg-rose-50 dark:text-[#0b1f52]"
                                      : "text-[#0b1f52] hover:bg-[#eef3fb] hover:text-[#0b1f52] dark:text-[#0b1f52] dark:hover:bg-[#eef3fb] dark:hover:text-[#0b1f52]"
                                  }`}
                                  onClick={() => {
                                    setProfileJobTitle(jobTitleOption);
                                    setJobTitleMenuOpen(false);
                                  }}
                                >
                                  <span>{jobTitleOption}</span>
                                  {isSelected ? <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--tc-accent)">Atual</span> : null}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-4 text-sm font-semibold text-[#0b1f52] dark:text-[#0b1f52]">
                              Nenhum cargo conhecido encontrado. Voce pode digitar um cargo personalizado.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    <FieldHint tone="strong">Selecione na lista ou digite um cargo personalizado.</FieldHint>
                  </div>
                </Field>

                <Field label="LinkedIn">
                  <input
                    className={`form-control-user ${inputClass}`}
                    value={profileLinkedinUrl}
                    onChange={(event) => setProfileLinkedinUrl(event.target.value)}
                    disabled={profileLoading || loading}
                    placeholder="https://www.linkedin.com/in/seu-perfil"
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4 border-t border-(--tc-border) pt-6">
              <PanelSectionTitle title="Preferencias" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tema">
                  <select
                    className={`form-control-user ${selectInputClass}`}
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as Theme)}
                    disabled={profileLoading || settingsLoading}
                    title="Tema"
                  >
                    <option value="system">Automatico</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                  </select>
                </Field>

                <Field label="Idioma">
                  <select
                    className={`form-control-user ${selectInputClass}`}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as Language)}
                    disabled={profileLoading || settingsLoading}
                    title="Idioma"
                  >
                    <option value="pt-BR">Portugues Brasil</option>
                    <option value="en-US">English US</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="space-y-3 border-t border-(--tc-border) pt-6">
              <Feedback message={profileError} tone="error" />
              <Feedback message={profileSuccess} tone="success" />
              <div className="flex justify-end">
                <button type="submit" className={primaryButtonClass} disabled={profileLoading || loading || settingsLoading}>
                  {profileLoading ? "Salvando..." : "Salvar perfil"}
                </button>
              </div>
            </div>
          </section>

          <section className={`${surfaceClass} space-y-5`}>
            <PanelHeader title="Foto do perfil" />

            <div className="rounded-3xl border border-(--tc-border) bg-white px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:bg-(--tc-surface-2)">
              <div className="flex flex-col items-center gap-4 text-center">
                <UserAvatar
                  src={previewAvatarUrl || null}
                  name={heroName}
                  showFallback={!avatarLoadingPlaceholder}
                  size="xl"
                  editable
                  onEdit={() => avatarInputRef.current?.click()}
                  frameClassName="border-4 border-white bg-transparent shadow-[0_20px_44px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 dark:ring-white/10"
                  fallbackClassName="text-2xl font-bold tracking-[0.18em] text-slate-600 dark:text-white"
                  buttonClassName="bg-(--tc-primary) text-white hover:bg-(--tc-accent)"
                />
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">
                    {avatarUploading ? "Enviando foto..." : profileAvatarFile ? "A nova foto aparece aqui antes de salvar." : "Upload e URL usam uma unica origem por vez."}
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Selecionar foto de perfil"
                  onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
                />
              </div>
            </div>

            <Field label="URL da foto">
              <input
                className={`form-control-user ${inputClass}`}
                value={profileAvatarUrlInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setProfileAvatarUrlInput(nextValue);
                  if (nextValue.trim()) {
                    setProfileAvatarSource("url");
                    setProfileAvatarFile(null);
                    setProfileUploadedAvatarUrl("");
                    setProfileAvatarDirty(true);
                    return;
                  }
                  setProfileAvatarSource(null);
                  setProfileAvatarFile(null);
                  setProfileUploadedAvatarUrl("");
                  setProfileAvatarDirty(true);
                }}
                disabled={profileLoading || loading}
                placeholder="https://exemplo.com/foto.jpg"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-(--tc-accent) dark:text-[#ff8a8a]">
              <span>
                {profileAvatarDirty
                  ? "Preview local. Salve para aplicar na capa e no menu."
                  : heroAvatarUrl
                    ? "A foto salva aparece na capa e no menu."
                    : "Sem foto, a conta usa as iniciais."}
              </span>
              {(profileAvatarDirty || heroAvatarUrl) ? (
                <button
                  type="button"
                  className="rounded-full border border-[#0b1f52] bg-[#eef3fb] px-3 py-1 font-semibold text-[#0b1f52] transition hover:border-(--tc-accent) hover:bg-(--tc-accent) hover:text-white dark:border-[#d7e5ff] dark:bg-[#122038] dark:text-[#d7e5ff] dark:hover:border-(--tc-accent) dark:hover:bg-(--tc-accent) dark:hover:text-white"
                  onClick={() => {
                    setProfileAvatarSource(null);
                    setProfileAvatarUrlInput("");
                    setProfileAvatarFile(null);
                    setProfileUploadedAvatarUrl("");
                    setProfileAvatarDirty(true);
                    setProfileSuccess(null);
                    setProfileError(null);
                  }}
                  disabled={profileLoading || avatarUploading || loading}
                >
                  Remover foto
                </button>
              ) : null}
            </div>

          </section>
        </form>

        <section className={`${surfaceClass} space-y-5`}>
          <PanelHeader title="Senha" />

          <form className="grid gap-4 xl:grid-cols-3" onSubmit={handlePasswordSubmit}>
            <Field label="Senha atual">
              <input
                type="password"
                className={`form-control-user ${inputClass}`}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                title="Senha atual"
                placeholder="••••••••"
                required
              />
            </Field>

            <Field label="Nova senha">
              <input
                type="password"
                className={`form-control-user ${inputClass}`}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                title="Nova senha"
                placeholder="••••••••"
                required
              />
            </Field>

            <Field label="Confirmar nova senha">
              <input
                type="password"
                className={`form-control-user ${inputClass}`}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                title="Confirmar nova senha"
                placeholder="••••••••"
                required
              />
            </Field>

            <div className="space-y-3 xl:col-span-3">
              <Feedback message={passwordError} tone="error" />
              <Feedback message={passwordSuccess} tone="success" />
            </div>

            <div className="flex justify-end xl:col-span-3">
              <button type="submit" className={primaryButtonClass} disabled={passwordLoading}>
                {passwordLoading ? "Atualizando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </section>

        {hasCompanyContext ? (
          <section className={`${surfaceClass} space-y-5`}>
            <PanelHeader title="Empresas vinculadas" />

            <div className="space-y-3">
              <Feedback message={companiesError} tone="error" />

              {!companiesError && uniqueCompanies.length === 0 ? (
                <div className="tc-empty-state min-h-45">
                  Nenhuma empresa vinculada encontrada para este usuario.
                </div>
              ) : null}

              {uniqueCompanies.length > 0 ? (
                <div className="divide-y divide-(--tc-border)">
                  {uniqueCompanies.map((company) => (
                    <article key={company.client_id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate text-base font-semibold text-(--tc-text-primary)" title={company.client_name}>
                            {company.client_name}
                        </h3>
                        <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">{company.client_slug}</p>
                        <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">
                          {company.client_active ? "Empresa ativa" : "Empresa inativa"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass(company.link_active ? "positive" : "warning")}`}>
                            <span className="h-2 w-2 rounded-full bg-current" />
                            {company.link_active ? "Vinculo ativo" : "Vinculo inativo"}
                          </span>
                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClass("neutral")}`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {company.role}
                        </span>
                        <Link href={`/empresas/${encodeURIComponent(company.client_slug)}/home`} className={secondaryButtonClass}>
                          Abrir empresa
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={`${surfaceClass} space-y-5`}>
          <PanelHeader title="Deletar perfil" description={canDeleteDirectly ? "Acao definitiva para perfis administrativos e globais." : "Perfis comuns precisam solicitar a exclusao para analise."} />

          <div className="space-y-3">
            <Feedback message={deleteUserError} tone="error" />
            <Feedback message={deleteUserSuccess} tone="success" />
            <Feedback message={deleteRequestError} tone="error" />
            <Feedback message={deleteRequestSuccess} tone="success" />

            {canDeleteDirectly ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={`${dangerButtonClass} justify-center`}
                  disabled={deleteUserLoading}
                  onClick={() => {
                    setDeleteUserError(null);
                    setDeleteUserSuccess(null);
                    setDeleteUserConfirmOpen(true);
                  }}
                >
                  <FiTrash2 size={15} />
                  {deleteUserLoading ? "Deletando..." : "Deletar perfil"}
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={dangerButtonClass}
                  disabled={deleteRequestLoading}
                  onClick={() => {
                    setDeleteRequestError(null);
                    setDeleteRequestOpen(true);
                  }}
                >
                  <FiTrash2 size={15} />
                  Solicitar exclusao de perfil
                </button>
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          open={!!usernameReplacementDialog}
          title="Trocar login da conta"
          description={
            usernameReplacementDialog
              ? usernameReplacementDialog.mode === "generate"
                ? `O login atual @${usernameReplacementDialog.currentUsername} sera substituido por @${usernameReplacementDialog.nextUsername}. O login atual deixara de funcionar.`
                : `Salvar com o campo de usuario em branco vai substituir o login atual @${usernameReplacementDialog.currentUsername} por um novo login gerado automaticamente. O login atual deixara de funcionar.`
              : undefined
          }
          confirmLabel={usernameReplacementDialog?.mode === "generate" ? "Aplicar login" : "Salvar com novo login"}
          cancelLabel="Cancelar"
          onCancel={() => setUsernameReplacementDialog(null)}
          onConfirm={() => {
            if (!usernameReplacementDialog) return;
            if (usernameReplacementDialog.mode === "generate") {
              setProfileUsername(usernameReplacementDialog.nextUsername);
              setUsernameReplacementDialog(null);
              return;
            }
            const nextAction = usernameReplacementDialog;
            setProfileUsername(nextAction.nextUsername);
            setUsernameReplacementDialog(null);
            void submitProfileChanges({
              allowGeneratedReplacement: nextAction.mode === "submit",
              forcedGeneratedUsername: nextAction.nextUsername,
            });
          }}
        />

        <ConfirmDialog
          open={deleteUserConfirmOpen}
          title={directDeleteModalTitle}
          description={directDeleteModalDescription}
          confirmLabel={deleteUserLoading ? "Deletando..." : "Confirmar exclusao"}
          cancelLabel="Cancelar"
          onCancel={() => {
            if (deleteUserLoading) return;
            setDeleteUserConfirmOpen(false);
          }}
          onConfirm={() => {
            if (deleteUserLoading) return;
            setDeleteUserConfirmOpen(false);
            void handleDeleteUser();
          }}
        />

        {deleteRequestOpen ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !deleteRequestLoading && setDeleteRequestOpen(false)} />
            <div className="relative z-70 w-full max-w-xl rounded-2xl border border-(--tc-border) bg-(--tc-surface) p-5 shadow-[0_30px_80px_rgba(2,6,23,0.6)]">
              <h3 className="text-base font-semibold text-(--tc-text-primary)">Solicitar exclusao de perfil</h3>
              <p className="mt-1 text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">Explique o motivo para a equipe administrativa analisar a exclusao.</p>

              <div className="mt-4 space-y-2">
                <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary)">
                  <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-(--tc-accent) dark:text-[#ff8a8a]">Motivo</span>
                  <textarea
                    className="min-h-35 w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm font-medium text-[#0b1f52] outline-none transition placeholder:text-[#345388] focus:border-(--tc-accent) focus:bg-rose-50/60 focus:ring-2 focus:ring-(--tc-accent)/18 dark:border-slate-500 dark:bg-[#0f1b2d] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:focus:bg-rose-500/10"
                    value={deleteRequestReason}
                    onChange={(event) => setDeleteRequestReason(event.target.value)}
                    placeholder="Descreva o motivo da exclusao do perfil."
                    disabled={deleteRequestLoading}
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteRequestOpen(false)}
                  className="rounded-md border border-slate-400 bg-white px-3 py-2 text-sm font-medium text-[#0b1f52] transition hover:border-(--tc-accent) hover:text-(--tc-accent) dark:border-slate-500 dark:bg-[#122038] dark:text-[#d7e5ff] dark:hover:text-rose-200"
                  disabled={deleteRequestLoading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleProfileDeletionRequest()}
                  className="rounded-md bg-(--tc-accent) px-3 py-2 text-sm font-semibold text-white shadow-sm"
                  disabled={deleteRequestLoading}
                >
                  {deleteRequestLoading ? "Enviando..." : "Solicitar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
