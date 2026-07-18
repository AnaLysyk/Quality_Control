"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { FiCheck, FiCloudLightning, FiEye, FiEyeOff, FiLink2, FiSearch, FiZap, FiEdit2 } from "react-icons/fi";
import { extractCnpjAddress, extractCnpjCompanyName, lookupCnpjCompany, normalizeCnpj, isCnpjValid } from "@/backend/brasilApiCnpj";
import UserAvatar from "@/components/UserAvatar";
import { AvatarLibraryDialog, type AvatarLibraryChoice } from "@/components/AvatarLibraryDialog";

export type ClientIntegrationMode = "qase" | "manual";

export type ClientFormValues = {
  name: string;
  taxId?: string;
  zip?: string;
  address?: string;
  addressNumber?: string;
  addressDetail?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  linkedin?: string;
  docsLink?: string;
  notificationsFanoutEnabled?: boolean;
  companyUsername?: string;
  notes?: string;
  description?: string;
  adminEmail?: string;
  active: boolean;
  integrationMode: ClientIntegrationMode;
  qaseToken?: string;
  qaseProjectCode?: string;
  qaseProjectCodes?: string[];
  qase_projects?: { code: string; title?: string; imageUrl?: string | null; status?: "unknown" | "valid" | "invalid" }[];
  integrations?: { type: string; config?: Record<string, unknown> }[];
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
};

type ProjectStatus = "unknown" | "valid" | "invalid";

type QaseProjectOption = {
  code: string;
  title: string;
  status?: ProjectStatus;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: ClientFormValues) => Promise<{ id: string } | null> | { id: string } | null | void;
  onUpdate?: (id: string, data: ClientFormValues) => Promise<void>;
  onOpenUser?: (clientId: string) => void;
  clientId?: string | null;
  mode?: 'create' | 'view' | 'edit';
  syncWithMyProfile?: boolean;
};

function readId(value: unknown): string | null {
  const record = (value ?? null) as Record<string, unknown> | null;
  return typeof record?.id === "string" ? record.id : null;
}

function uniqCodes(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean)));
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function suggestCompanyUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, "")
    .slice(0, 40);
}

function resolveCompanyLogoLibraryKind(value?: string | null): AvatarLibraryChoice["avatarKind"] {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "default";
  if (!/^(https?:\/\/|\/|blob:|data:)/i.test(normalized)) return "emoji";
  if (/\.gif(?:$|\?)/i.test(normalized) || normalized.includes("media.giphy.com")) return "gif";
  return "image";
}

function buildViaCepAddress(data: Record<string, unknown>) {
  return [
    typeof data.logradouro === "string" ? data.logradouro : "",
    typeof data.bairro === "string" ? data.bairro : "",
    typeof data.localidade === "string" ? data.localidade : "",
    typeof data.uf === "string" ? data.uf : "",
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function CreateClientModal({ open, onClose, onCreate, onUpdate, onOpenUser, clientId, mode = 'create', syncWithMyProfile = false }: Props) {
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [logoPreviewObjectUrl, setLogoPreviewObjectUrl] = useState<string | null>(null);
  const [logoLibraryOpen, setLogoLibraryOpen] = useState(false);
  const [logoLabel, setLogoLabel] = useState("Sem logo");
  const [linkedin, setLinkedin] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [notificationsFanoutEnabled, setNotificationsFanoutEnabled] = useState(false);
  const [companyUsername, setCompanyUsername] = useState("");
  const [generatingUsername, setGeneratingUsername] = useState(false);
  const [active, setActive] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  // integrationMode removed: Qase fields are always visible
  const [qaseToken, setQaseToken] = useState("");
  const [showQaseToken, setShowQaseToken] = useState(false);
  const [qaseProjectCode, setQaseProjectCode] = useState("");
  const [qaseProjects, setQaseProjects] = useState<QaseProjectOption[]>([]);
  const [selectedQaseProjectCodes, setSelectedQaseProjectCodes] = useState<string[]>([]);
  const [loadingQaseProjects, setLoadingQaseProjects] = useState(false);
  const [qaseProjectsError, setQaseProjectsError] = useState<string | null>(null);
  const [testingQase, setTestingQase] = useState(false);
  const [qaseTestStatus, setQaseTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [qaseTestMessage, setQaseTestMessage] = useState<string | null>(null);
  const [searchProjects, setSearchProjects] = useState("");
  const [showAddManual, setShowAddManual] = useState(false);
  const [onlyValid, setOnlyValid] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const projectsRef = useRef<HTMLDivElement | null>(null);
  const [validatingProjects, setValidatingProjects] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(clientId ?? null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [addressTouched, setAddressTouched] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(mode === 'create' || mode === 'edit');
  const [profileSyncDetected, setProfileSyncDetected] = useState(false);
  const cnpjLookupIdRef = useRef(0);
  const cnpjLookupControllerRef = useRef<AbortController | null>(null);
  const lastAutoCnpjLookupRef = useRef("");
  const isMountedRef = useRef(true);

  const logoKind = useMemo(() => resolveCompanyLogoLibraryKind(logoUrl), [logoUrl]);
  const companyLogoPreviewName = name || companyUsername || adminEmail || "Empresa";
  const companyLogoPreviewSrc = logoPreviewObjectUrl ?? (logoUrl.trim() || null);

  function clearCompanyLogoObjectPreview() {
    if (logoPreviewObjectUrl) {
      URL.revokeObjectURL(logoPreviewObjectUrl);
      setLogoPreviewObjectUrl(null);
    }
    setLogoFileName("");
  }

  function handleCompanyLogoLibraryChoice(choice: AvatarLibraryChoice) {
    setError(null);

    if (choice.avatarValue.startsWith("data:image/") && choice.avatarValue.length > 500000) {
      setError("Imagem muito grande para salvar na empresa. Use GIF por URL, emoji, ícone ou uma imagem menor.");
      return;
    }

    clearCompanyLogoObjectPreview();

    if (choice.avatarKind === "default") {
      setLogoUrl("");
      setLogoLabel("Sem logo");
      return;
    }

    setLogoUrl(choice.avatarValue);
    setLogoLabel(choice.avatarLabel || "Logo da empresa");
  }

  function clearCompanyLogoChoice() {
    clearCompanyLogoObjectPreview();
    setLogoUrl("");
    setLogoLabel("Sem logo");
  }

  // AUTO CNPJ LOOKUP
  useEffect(() => {
    if (!open || !isEditing) return;

    const rawCnpj = normalizeCnpj(taxId);

    if (!rawCnpj) {
      lastAutoCnpjLookupRef.current = "";
      setCnpjMessage(null);
      return;
    }

    if (rawCnpj.length < 14) {
      setCnpjMessage("Digite os 14 dígitos do CNPJ.");
      return;
    }

    if (!isCnpjValid(rawCnpj)) {
      setCnpjMessage("❌ CNPJ inválido (checksum falhou).");
      return;
    }

    if (lastAutoCnpjLookupRef.current === rawCnpj) return;

    const timer = window.setTimeout(() => {
      lastAutoCnpjLookupRef.current = rawCnpj;
      void handleCnpjBlur();
    }, 450);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditing, taxId]);

  const selectedProjects = useMemo(
    () => qaseProjects.filter((project) => selectedQaseProjectCodes.includes(project.code)),
    [qaseProjects, selectedQaseProjectCodes],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cnpjLookupControllerRef.current?.abort();
      if (logoPreviewObjectUrl) URL.revokeObjectURL(logoPreviewObjectUrl);
    };
  }, [logoPreviewObjectUrl]);

  useEffect(() => {
    if (!open) return;
    const digits = zip.replace(/\D/g, "");
    if (digits.length === 0) {
      setCepMessage(null);
      return;
    }
    if (digits.length < 8) {
      setCepMessage("Digite os 8 digitos do CEP.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);

    async function lookupCep() {
      setCepLoading(true);
      setCepMessage(null);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        if (!response.ok || !data || data.erro === true) {
          setCepMessage("CEP nao encontrado.");
          return;
        }

        const nextAddress = buildViaCepAddress(data);
        if (nextAddress && (!address.trim() || !addressTouched)) {
          setAddress(nextAddress);
          setAddressTouched(false);
        }
        setCepMessage("Endereco preenchido pelo CEP.");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setCepMessage("Consulta de CEP demorou demais. Tente novamente.");
          return;
        }
        setCepMessage("Nao foi possivel consultar o CEP agora.");
      } finally {
        window.clearTimeout(timeoutId);
        setCepLoading(false);
      }
    }

    void lookupCep();
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [address, addressTouched, open, zip]);

  async function handleCnpjBlur() {
    const rawCnpj = normalizeCnpj(taxId);
    if (rawCnpj.length !== 14) {
      setCnpjMessage(null);
      return;
    }

    if (!isCnpjValid(rawCnpj)) {
      setCnpjMessage("❌ CNPJ inválido (checksum falhou).");
      return;
    }

    const lookupId = ++cnpjLookupIdRef.current;
    cnpjLookupControllerRef.current?.abort();
    const controller = new AbortController();
    cnpjLookupControllerRef.current = controller;

    setCnpjLoading(true);
    setCnpjMessage("✓ CNPJ válido. Consultando BrasilAPI...");

    try {
      const data = await lookupCnpjCompany(rawCnpj, controller.signal);
      const companyName = extractCnpjCompanyName(data);
      const companyAddress = extractCnpjAddress(data);
      const phonePrimary = typeof data?.ddd_telefone_1 === "string" ? data.ddd_telefone_1 : "";
      const phoneSecondary = typeof data?.ddd_telefone_2 === "string" ? data.ddd_telefone_2 : "";
      const contactPhone = phonePrimary || phoneSecondary;
      const cnae = typeof data?.cnae_fiscal_descricao === "string" ? data.cnae_fiscal_descricao.trim() : "";
      const companyStatus = typeof data?.descricao_situacao_cadastral === "string" ? data.descricao_situacao_cadastral.trim() : "";
      const legalNature = typeof data?.natureza_juridica === "string" ? data.natureza_juridica.trim() : "";
      const openedAt = typeof data?.abertura === "string" ? data.abertura.trim() : "";
      const contactEmail = typeof data?.email === "string" ? data.email.trim() : "";
      const simpleOpt = typeof data?.opcao_pelo_simples === "boolean" ? data.opcao_pelo_simples : null;

      if (!isMountedRef.current || lookupId !== cnpjLookupIdRef.current) return;

      if (companyName) {
        setName((currentName) => (currentName.trim() ? currentName : companyName));
        setCompanyUsername((current) => current.trim() || suggestCompanyUsername(companyName));
      }

      if (contactEmail) {
        setAdminEmail((current) => current.trim() || contactEmail.toLowerCase());
      }
      setZip((current) => current.trim() || (typeof data?.cep === "string" ? formatCep(data.cep) : ""));
      setAddress((current) => current.trim() || companyAddress || "");
      setAddressNumber((current) => current.trim() || (typeof data?.numero === "string" ? data.numero : ""));
      setAddressDetail((current) => current.trim() || (typeof data?.complemento === "string" ? data.complemento : ""));
      setPhone((current) => current.trim() || contactPhone);
      setDescription((current) => current.trim() || cnae || "");

      if (!notes.trim()) {
        const notesParts: string[] = [];
        if (companyStatus) notesParts.push(`Situacao cadastral: ${companyStatus}`);
        if (legalNature) notesParts.push(`Natureza juridica: ${legalNature}`);
        if (openedAt) notesParts.push(`Data de abertura: ${openedAt}`);
        if (contactEmail) notesParts.push(`E-mail cadastral: ${contactEmail}`);
        if (simpleOpt !== null) notesParts.push(`Simples nacional: ${simpleOpt ? "Sim" : "Nao"}`);
        if (notesParts.length) {
          setNotes(notesParts.join(" | "));
        }
      }

      if (companyName || companyAddress || data?.cep || data?.numero || data?.complemento || contactPhone || cnae || contactEmail) {
        setCnpjMessage("✓ CNPJ válido. Dados preenchidos pela BrasilAPI.");
      } else {
        setCnpjMessage("✓ CNPJ válido, mas sem dados adicionais na BrasilAPI.");
      }
    } catch (error) {
      if (!isMountedRef.current || lookupId !== cnpjLookupIdRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Nao foi possivel consultar a BrasilAPI";
      if (/demorou demais/i.test(message) || /504/.test(message)) {
        setCnpjMessage("BrasilAPI demorou para responder. Tente novamente em instantes.");
      } else if (/502/.test(message) || /Nao foi possivel consultar a BrasilAPI/i.test(message)) {
        setCnpjMessage("BrasilAPI indisponivel (502). Preencha manualmente e tente novamente depois.");
      } else {
        setCnpjMessage(message);
      }
    } finally {
      if (isMountedRef.current && lookupId === cnpjLookupIdRef.current) {
        setCnpjLoading(false);
        if (cnpjLookupControllerRef.current === controller) {
          cnpjLookupControllerRef.current = null;
        }
      }
    }
  }

  useEffect(() => {
    if (!clientId) return;
    let mounted = true;
    (async () => {
      setLoadingClient(true);
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId as string)}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        if (!mounted) return;
        // populate fields
        setName((data.name as string) ?? "");
        setTaxId((data.tax_id as string) ?? "");
        setZip((data.cep as string) ?? "");
        setAddress((data.address as string) ?? "");
        setAddressNumber((data.address_number as string) ?? "");
        setAddressDetail((data.address_detail as string) ?? "");
        setAddressTouched(false);
        setPhone((data.phone as string) ?? "");
        setWebsite((data.website as string) ?? "");
        setLogoUrl((data.logo_url as string) ?? "");
        setLinkedin((data.linkedin_url as string) ?? "");
        setNotes((data.notes as string) ?? "");
        setDescription((data.short_description as string) ?? "");
        setNotificationsFanoutEnabled(typeof data.notifications_fanout_enabled === "boolean" ? data.notifications_fanout_enabled : false);
        setActive(typeof data.active === "boolean" ? data.active : false);
        setQaseToken((data.qase_token as string) ?? "");
        const codes = Array.isArray(data.qase_project_codes) ? data.qase_project_codes.map((c: any) => (typeof c === "string" ? c : String(c))) : [];
        setSelectedQaseProjectCodes(codes.map((c: string) => c.trim().toUpperCase()));
        setQaseProjectCode((data.qase_project_code as string) ?? (codes?.[0] ?? ""));
      } catch {
        // ignore
      } finally {
        setLoadingClient(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!open || !syncWithMyProfile) return;
    if (mode !== "create" || clientId) return;

    let mounted = true;
    (async () => {
      try {
        const [profileRes, meRes] = await Promise.all([
          fetch("/api/me/company-profile", { credentials: "include", cache: "no-store" }).catch(() => null),
          fetch("/api/me", { credentials: "include", cache: "no-store" }).catch(() => null),
        ]);

        if (!mounted) return;

        if (profileRes && profileRes.ok) {
          const data = (await profileRes.json().catch(() => null)) as Record<string, unknown> | null;
          if (data) {
            setProfileSyncDetected(true);
            setName((current) => current.trim() || (typeof data.company_name === "string" ? data.company_name : typeof data.name === "string" ? data.name : ""));
            setTaxId((current) => current.trim() || (typeof data.tax_id === "string" ? data.tax_id : ""));
            setZip((current) => current.trim() || (typeof data.cep === "string" ? data.cep : ""));
            setAddress((current) => current.trim() || (typeof data.address === "string" ? data.address : ""));
            setAddressNumber((current) => current.trim() || (typeof data.address_number === "string" ? data.address_number : ""));
            setAddressDetail((current) => current.trim() || (typeof data.address_detail === "string" ? data.address_detail : ""));
            setPhone((current) => current.trim() || (typeof data.phone === "string" ? data.phone : ""));
            setWebsite((current) => current.trim() || (typeof data.website === "string" ? data.website : ""));
            setLogoUrl((current) => current.trim() || (typeof data.logo_url === "string" ? data.logo_url : ""));
            if (typeof data.logo_url === "string" && data.logo_url.trim()) setLogoLabel("Logo salva");
            setLinkedin((current) => current.trim() || (typeof data.linkedin_url === "string" ? data.linkedin_url : ""));
            setNotificationsFanoutEnabled(typeof data.notifications_fanout_enabled === "boolean" ? data.notifications_fanout_enabled : false);
          }
        }

        if (meRes && meRes.ok) {
          const me = (await meRes.json().catch(() => null)) as { user?: { user?: string; username?: string } } | null;
          const login = me?.user?.username || me?.user?.user || "";
          if (login) {
            setCompanyUsername((current) => current.trim() || login);
          }
        }
      } catch {
        // keep modal working even without profile endpoint access
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, syncWithMyProfile, mode, clientId]);

  async function handleGenerateCompanyUsername() {
    const seed = (name || taxId || "empresa").trim();
    if (!seed) return;
    setGeneratingUsername(true);
    try {
      const response = await fetch("/api/me/username-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ seed, avoid: companyUsername ? [companyUsername] : [] }),
      });
      const payload = (await response.json().catch(() => null)) as { username?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível gerar o usuário da empresa.");
      }
      const generated = (payload?.username ?? "").trim().toLowerCase();
      if (generated) setCompanyUsername(generated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível gerar o usuário da empresa.";
      toast.error(message);
    } finally {
      setGeneratingUsername(false);
    }
  }

  async function syncInstitutionalProfile() {
    if (!syncWithMyProfile) return;
    if (!profileSyncDetected) return;

    try {
      await fetch("/api/me/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          company_name: name.trim(),
          tax_id: taxId.trim() || null,
          cep: zip.trim() || null,
          address: address.trim() || null,
          address_number: addressNumber.trim() || null,
          address_detail: addressDetail.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          linkedin_url: linkedin.trim() || null,
          logo_url: logoUrl.trim() || null,
          notifications_fanout_enabled: notificationsFanoutEnabled,
          qase_token: qaseToken.trim() || undefined,
          qase_project_codes: uniqCodes(selectedQaseProjectCodes),
          integration_mode: uniqCodes(selectedQaseProjectCodes).length || qaseToken.trim() ? "qase" : "manual",
        }),
      }).catch(() => null);

      if (companyUsername.trim()) {
        await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user: companyUsername.trim().toLowerCase() }),
        }).catch(() => null);
      }
    } catch {
      // silent: profile sync is best-effort
    }
  }

  // close projects dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!projectsOpen) return;
      const el = projectsRef.current;
      if (!el) return;
      if (e.target && el.contains(e.target as Node)) return;
      setProjectsOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProjectsOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [projectsOpen]);

  function resetQaseSelection() {
    setQaseProjectCode("");
    setQaseProjects([]);
    setSelectedQaseProjectCodes([]);
    setQaseProjectsError(null);
  }

  function resetForm() {
    cnpjLookupIdRef.current += 1;
    lastAutoCnpjLookupRef.current = "";
    cnpjLookupControllerRef.current?.abort();
    cnpjLookupControllerRef.current = null;
    setName("");
    setTaxId("");
    setZip("");
    setAddress("");
    setAddressNumber("");
    setAddressDetail("");
    setAddressTouched(false);
    setPhone("");
    setWebsite("");
    setLogoUrl("");
    setLogoFileName("");
    setLogoLibraryOpen(false);
    setLogoLabel("Sem logo");
    setLinkedin("");
    setNotes("");
    setDescription("");
    setNotificationsFanoutEnabled(false);
    setCompanyUsername("");
    setActive(false);
    setQaseToken("");
    resetQaseSelection();
    if (logoPreviewObjectUrl) {
      URL.revokeObjectURL(logoPreviewObjectUrl);
      setLogoPreviewObjectUrl(null);
    }
    setError(null);
    setCnpjLoading(false);
    setCnpjMessage(null);
  }

  function toggleSelectedQaseProject(code: string) {
    setSelectedQaseProjectCodes((current) => {
      const exists = current.includes(code);
      const next = exists ? current.filter((item) => item !== code) : [...current, code];
      if (!exists && !qaseProjectCode) {
        setQaseProjectCode(code);
      }
      if (exists && qaseProjectCode === code) {
        setQaseProjectCode(next[0] ?? "");
      }
      return next;
    });
  }

  function selectAllQaseProjects() {
    const next = qaseProjects.map((project) => project.code);
    setSelectedQaseProjectCodes(next);
    if (!qaseProjectCode && next[0]) {
      setQaseProjectCode(next[0]);
    }
  }

  function clearQaseProjects() {
    setSelectedQaseProjectCodes([]);
    setQaseProjectCode("");
  }

  async function handleFetchQaseProjects() {
    const token = qaseToken.trim();
    if (!token) {
      setQaseProjectsError("Informe o token da Qase antes de buscar os projetos.");
      return;
    }

    setLoadingQaseProjects(true);
    setQaseProjectsError(null);
    try {
      const res = await fetch("/api/admin/qase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, all: true }),
      });
      const data = (await res.json().catch(() => null)) as { items?: QaseProjectOption[]; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível consultar os projetos da Qase.");
      }

      const items = Array.isArray(data?.items)
        ? data.items
            .filter((item) => item && typeof item.code === "string")
            .map((item) => ({
              code: item.code.trim().toUpperCase(),
              title: item.title?.trim() || item.code.trim().toUpperCase(),
              status: "valid" as ProjectStatus,
            }))
        : [];

      setQaseProjects(items);
      setSelectedQaseProjectCodes((current) => {
        const valid = new Set(items.map((item) => item.code));
        const preserved = current.filter((code) => valid.has(code));
        if (preserved.length > 0) return preserved;
        if (items.length === 1) return [items[0].code];
        return [];
      });
      setQaseProjectCode((current) => {
        if (current && items.some((item) => item.code === current)) return current;
        if (items.length === 1) return items[0].code;
        return "";
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao buscar projetos na Qase.";
      setQaseProjects([]);
      setSelectedQaseProjectCodes([]);
      setQaseProjectCode("");
      setQaseProjectsError(message);
    } finally {
      setLoadingQaseProjects(false);
    }
  }

  async function validateProjectCode(token: string, code: string) {
    try {
      const res = await fetch("/api/admin/qase/projects/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, code }),
      });
      const data = await res.json().catch(() => null);
      return res.ok && data?.valid === true;
    } catch {
      return false;
    }
  }

  function addManualProject() {
    const code = (manualCode || "").trim().toUpperCase();
    const name = (manualName || "").trim() || code;
    if (!code) {
      setQaseProjectsError("Informe o codigo do projeto Qase.");
      return;
    }
    // avoid duplicates
    if (qaseProjects.some((p) => p.code === code) || selectedQaseProjectCodes.includes(code)) {
      setQaseProjectsError("Projeto já adicionado.");
      return;
    }
    const project: QaseProjectOption = { code, title: name, status: "unknown" };
    setQaseProjects((prev) => [...prev, project]);
    setSelectedQaseProjectCodes((prev) => [...prev, code]);
    if (!qaseProjectCode) setQaseProjectCode(code);
    setManualCode("");
    setManualName("");
    setShowAddManual(false);
    setQaseProjectsError(null);
    // try validate in background
    (async () => {
      const token = qaseToken.trim();
      if (!token) return;
      const ok = await validateProjectCode(token, code);
      setQaseProjects((prev) => prev.map((p) => (p.code === code ? { ...p, status: ok ? "valid" : "invalid" } : p)));
    })();
  }

  useEffect(() => {
    const hasPending = qaseProjects.some((p) => !p.status || p.status === "unknown");
    const token = qaseToken.trim();
    if (qaseProjects.length > 0 && hasPending && token && !validatingProjects) {
      void validatePendingProjects();
    }
    // only when qaseProjects or qaseToken changes
  }, [qaseProjects, qaseToken]);

  async function validatePendingProjects() {
    const token = qaseToken.trim();
    if (!token) {
      setQaseProjects((prev) => prev.map((p) => (p.status ? p : { ...p, status: "unknown" })));
      return;
    }
    setValidatingProjects(true);
    try {
      for (const project of qaseProjects) {
        if (project.status === "valid" || project.status === "invalid") continue;
        try {
          // validate sequentially to avoid burst
           
          const ok = await validateProjectCode(token, project.code);
          setQaseProjects((prev) => prev.map((p) => (p.code === project.code ? { ...p, status: ok ? "valid" : "invalid" } : p)));
        } catch {
          setQaseProjects((prev) => prev.map((p) => (p.code === project.code ? { ...p, status: "unknown" } : p)));
        }
      }
    } finally {
      setValidatingProjects(false);
    }
  }

  function removeSelectedProject(code: string) {
    setSelectedQaseProjectCodes((current) => current.filter((c) => c !== code));
    if (qaseProjectCode === code) {
      const remaining = selectedQaseProjectCodes.filter((c) => c !== code);
      setQaseProjectCode(remaining[0] ?? "");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }

    // Validate CNPJ if provided
    if (taxId.trim()) {
      const rawCnpj = normalizeCnpj(taxId);
      if (!isCnpjValid(rawCnpj)) {
        setError("CNPJ inválido. Verifique o número.");
        return;
      }
    }

    // Validate Qase-related fields only when user selected projects or provided a token
    {
      const token = qaseToken.trim();
      const selectedCodes = uniqCodes(selectedQaseProjectCodes);
      const primaryProject = qaseProjectCode.trim().toUpperCase();

      if (selectedCodes.length > 0) {
        if (!token) {
          setError("Informe o token da Qase para vincular projetos.");
          return;
        }
        if (!primaryProject || !selectedCodes.includes(primaryProject)) {
          setError("Selecione o projeto principal da integração.");
          return;
        }
      }
    }

    setBusy(true);
    try {
      const selectedCodes = uniqCodes(selectedQaseProjectCodes);
      const qaseProjectsPayload = selectedProjects.map((p) => ({ code: p.code, title: p.title, imageUrl: p.imageUrl ?? null, status: p.status ?? "unknown" }));
      const integrationsPayload: { type: string; config?: Record<string, unknown> }[] = [];
      // build integrations array for multi-integration support
      if (qaseToken.trim() || (selectedCodes.length > 0)) {
        integrationsPayload.push({ type: "QASE", config: { token: qaseToken.trim() || null, projects: selectedCodes.length ? selectedCodes : undefined } });
      }

      const formData: ClientFormValues = {
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        zip: zip.trim() || undefined,
        address: address.trim() || undefined,
        addressNumber: addressNumber.trim() || undefined,
        addressDetail: addressDetail.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        notificationsFanoutEnabled,
        companyUsername: companyUsername.trim() || undefined,
        notes: notes.trim() || undefined,
        description: description.trim() || undefined,
        active,
        integrationMode: selectedCodes.length || qaseToken.trim() ? "qase" : "manual",
        adminEmail: adminEmail.trim() || undefined,
        qaseToken: qaseToken.trim() || undefined,
        qaseProjectCode: selectedCodes.length ? (selectedCodes[0] || "").trim().toUpperCase() : undefined,
        qaseProjectCodes: Array.isArray(selectedCodes) ? selectedCodes : [],
        qase_projects: qaseProjectsPayload.length ? qaseProjectsPayload : undefined,
        integrations: integrationsPayload.length ? integrationsPayload : undefined,
      };

      // Handle UPDATE mode
      if ((mode === 'edit' || (mode === 'view' && isEditing)) && clientId && onUpdate) {
        await onUpdate(clientId, formData);
        await syncInstitutionalProfile();
        toast.success("Empresa atualizada com sucesso");
        setIsEditing(false);
        onClose();
        return;
      }

      // Handle CREATE mode
      const result = await onCreate(formData);

      if (result === null || result === undefined) return;

      const newId = readId(result) ?? createdClientId;
      await syncInstitutionalProfile();
      setCreatedClientId(newId);
      resetForm();
      onClose();
      try {
        const messages: string[] = [];
        if (qaseToken.trim()) messages.push("Token salvo");
        if (Array.isArray(selectedQaseProjectCodes) && selectedQaseProjectCodes.length) messages.push(`Projetos vinculados: ${selectedQaseProjectCodes.length}`);
        if (newId) {
          try {
            const appsRes = await fetch(`/api/applications?companySlug=${encodeURIComponent(newId)}`);
            if (appsRes.ok) {
              const appsJson = await appsRes.json().catch(() => null);
              const apps = Array.isArray(appsJson?.items) ? appsJson.items : [];
              if (apps.length) messages.push(`Aplicações geradas: ${apps.length}`);
            }
          } catch {
            // ignore
          }
        }
        if (messages.length) {
          toast.success(messages.join(" — "));
        } else {
          toast.success("Empresa cadastrada");
        }
      } catch {
        toast.success("Empresa cadastrada");
      }

      if (newId && onOpenUser) {
        onOpenUser(newId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar empresa";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const isViewMode = mode === 'view' && !isEditing;
  const isEditMode = mode === 'create' || mode === 'edit' || (mode === 'view' && isEditing);
  const modalTitle = mode === 'create' ? 'Cadastrar empresa' : isViewMode ? 'Empresa' : 'Editar empresa';
  const submitButtonText = mode === 'create' ? 'Salvar empresa' : mode === 'edit' ? 'Salvar mudanças' : 'Salvar';

  function handleCloseOrCancel() {
    // From view->edit, cancel returns to read-only view.
    if (mode === "view" && isEditing) {
      setIsEditing(false);
      return;
    }

    // In create/edit flows, cancel should close the modal.
    resetForm();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-white/75 px-3 py-4 backdrop-blur-sm dark:bg-slate-950/65">
      <form
        aria-label={modalTitle}
        onSubmit={handleSubmit}
        className="w-full max-w-5xl max-h-[calc(100vh-48px)] overflow-hidden rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) shadow-[0_28px_90px_rgba(2,8,23,0.36)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[linear-gradient(135deg,#011848_0%,#10285d_48%,#6f102f_100%)] px-5 py-4 text-white sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/65">Gestao de empresas</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{modalTitle}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/78">
              {mode === 'create' 
                ? 'Preencha os dados principais e configure a integração se necessário.'
                : isViewMode
                ? 'Visualize os dados da empresa.'
                : 'Edite os dados da empresa.'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg leading-none text-white/80 transition hover:bg-white/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={handleCloseOrCancel}
            aria-label="Fechar ou cancelar edição"
          >
            x
          </button>
        </div>

        <div className="max-h-[calc(100vh-168px)] space-y-4 overflow-y-auto p-4 sm:p-6">
        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/35 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Nome / razão social
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Testing Company LTDA"
              required
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm">
            E-mail do administrador{mode === 'create' ? <span className="ml-1 text-(--tc-accent)">*</span> : null}
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@empresa.com"
              required={mode === 'create'}
              disabled={isViewMode}
              autoComplete="email"
            />
            {mode === 'create' && (
              <span className="mt-1 block text-xs text-(--tc-text-muted)">Usado para envio das credenciais de acesso.</span>
            )}
          </label>

          <label className="block text-sm">
            Status da empresa
            <div className="mt-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
                disabled={isViewMode}
              />
              <span className="text-sm text-(--tc-text)">{active ? 'Ativa' : 'Inativa'}</span>
            </div>
          </label>

          <label className="block text-sm">
            CNPJ
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={taxId}
              onChange={(e) => setTaxId(normalizeCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              onBlur={() => void handleCnpjBlur()}
              disabled={isViewMode}
            />
            <span className="mt-1 block min-h-4 text-xs text-(--tc-text-muted)" aria-live="polite">
              {cnpjLoading ? "Consultando BrasilAPI..." : cnpjMessage}
            </span>
          </label>

          <label className="block text-sm md:col-span-2">
            CEP
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={zip}
              onChange={(e) => setZip(formatCep(e.target.value))}
              placeholder="00000-000"
              inputMode="numeric"
              aria-describedby="company-cep-feedback"
              disabled={isViewMode}
            />
            <span id="company-cep-feedback" className="mt-1 block min-h-4 text-xs text-(--tc-text-muted)">
              {cepLoading ? "Consultando CEP..." : cepMessage}
            </span>
          </label>

          <label className="block text-sm md:col-span-2">
            Endereço
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, cidade"
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm">
            Número
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              placeholder="Ex.: 123"
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm md:col-span-2">
            Complemento / detalhe
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="Bloco, sala, referência"
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm">
            Telefone comercial
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 3333-3333"
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm">
            Website
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://exemplo.com"
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm">
            LinkedIn da empresa
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://www.linkedin.com/company/..."
              disabled={isViewMode}
            />
          </label>          <div className="md:col-span-2 rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar
                src={companyLogoPreviewSrc}
                name={companyLogoPreviewName}
                size="lg"
                editable={!isViewMode}
                onEdit={() => setLogoLibraryOpen(true)}
                frameClassName="border-4 border-white bg-white shadow-[0_16px_34px_rgba(15,23,42,0.14)] ring-1 ring-(--tc-border)"
                fallbackClassName="text-xl font-black tracking-[0.18em] text-(--tc-text-muted)"
                buttonClassName="bg-(--tc-accent,#ef0001) text-white hover:opacity-90"
                buttonLabel="Escolher logo da empresa"
              />

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-(--tc-text)">Logo da empresa</p>
                  <p className="mt-1 text-xs leading-5 text-(--tc-text-muted)">
                    Informe a logo oficial da empresa. Essa imagem será usada em PDFs, relatórios, cards e áreas institucionais.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLogoLibraryOpen(true)}
                    disabled={isViewMode}
                    className="rounded-lg bg-linear-to-b from-(--tc-accent,#ff4b4b) to-(--tc-accent-dark,#c30000) px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Escolher visual
                  </button>

                  {(logoUrl.trim() || logoPreviewObjectUrl) && !isViewMode ? (
                    <button
                      type="button"
                      onClick={clearCompanyLogoChoice}
                      className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--tc-text) transition hover:bg-(--tc-surface-2)"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>

                <label className="block text-xs font-semibold text-(--tc-text-muted)">
                  URL / valor salvo
                  <input
                    className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                    value={logoUrl}
                    onChange={(e) => {
                      clearCompanyLogoObjectPreview();
                      setLogoUrl(e.target.value);
                      setLogoLabel(e.target.value.trim() ? "Logo informada manualmente" : "Sem logo");
                    }}
                    placeholder="https://exemplo.com/logo.png ou imagem oficial da empresa"
                    disabled={isViewMode}
                  />
                </label>

                <p className="text-xs text-(--tc-text-muted)">
                  Logo selecionada: {companyLogoPreviewSrc ? logoLabel : "Sem logo"}
                </p>
              </div>
            </div>

            <AvatarLibraryDialog
              open={logoLibraryOpen}
              onOpenChange={setLogoLibraryOpen}
              value={logoUrl}
              kind={logoKind}
              onSelect={handleCompanyLogoLibraryChoice}
            />
          </div><div className="md:col-span-2 rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={notificationsFanoutEnabled}
                onChange={(e) => setNotificationsFanoutEnabled(e.target.checked)}
                className="mt-1 h-4 w-4"
                disabled={isViewMode}
              />
              <span>
                <span className="block font-semibold text-(--tc-text)">Fan-out de notificações</span>
                <span className="mt-1 block text-xs text-(--tc-text-muted)">
                  Quando ativo, mudanças no contexto da empresa notificam também usuários vinculados.
                </span>
              </span>
            </label>
          </div>

          <label className="block text-sm md:col-span-2">
            Usuário da empresa
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                value={companyUsername}
                onChange={(e) => setCompanyUsername(e.target.value)}
                placeholder="login institucional"
                disabled={isViewMode}
              />
              <button
                type="button"
                onClick={() => void handleGenerateCompanyUsername()}
                className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm font-semibold text-(--tc-text) disabled:opacity-60"
                disabled={isViewMode || generatingUsername || !name.trim()}
              >
                {generatingUsername ? "Gerando..." : "Gerar usuário"}
              </button>
            </div>
            <span className="mt-1 block text-xs text-(--tc-text-muted)">
              Login único do perfil institucional da empresa. Será usado no usuário que acessa o Meu Perfil dessa empresa.
            </span>
          </label>

          <fieldset className="md:col-span-2 rounded-2xl border border-sky-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] dark:border-sky-700/45 dark:bg-[linear-gradient(180deg,rgba(14,30,55,0.94)_0%,rgba(8,20,38,0.98)_100%)]" disabled={isViewMode}>
            <legend className="flex items-center gap-2 px-2 text-sm font-bold text-(--tc-text)">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-600 text-white shadow-sm"><FiLink2 size={12} /></span>
              Integração
            </legend>
            <p className="mt-1 text-xs leading-5 text-(--tc-text-muted)">
              Se a empresa tiver Qase, informe o token, busque os projetos e selecione as aplicações. Cada projeto selecionado será tratado como uma aplicação separada no painel, permitindo gerenciar diferentes produtos ou softwares de forma independente.
            </p>

            <div className="mt-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><FiZap size={13} className="text-sky-500" /> Integração com Qase</p>
              <p className="mt-1 text-xs text-(--tc-text-muted)">Informe o token da Qase (novo ou já salvo) e clique em &quot;Buscar projetos&quot; para carregar os projetos disponíveis. Selecione os projetos que deseja vincular — cada projeto selecionado será cadastrado como uma aplicação da empresa.</p>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block text-sm sm:col-span-2">
                  Token da Qase
                  <div className="relative mt-2">
                    <input
                      className="h-10 w-full rounded-xl border border-sky-200 bg-white px-3 pr-10 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:border-sky-700/55 dark:bg-slate-950/55 dark:text-slate-100 dark:focus-visible:ring-sky-500/50"
                      type={showQaseToken ? "text" : "password"}
                      value={qaseToken}
                      onChange={(e) => {
                        setQaseToken(e.target.value);
                        resetQaseSelection();
                      }}
                      placeholder="Token da conta"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isViewMode}
                    />
                    <button
                      type="button"
                      onClick={() => setShowQaseToken((v) => !v)}
                      className="absolute right-3 top-3 flex items-center text-slate-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-100"
                      aria-label={showQaseToken ? "Esconder token" : "Mostrar token"}
                      tabIndex={-1}
                      disabled={isViewMode}
                    >
                      {showQaseToken ? <FiEyeOff size={16} aria-hidden /> : <FiEye size={16} aria-hidden />}
                    </button>
                  </div>
                </label>

                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(180deg,#0f4f9f_0%,#07356f_100%)] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(7,53,111,0.22)] transition duration-150 hover:brightness-110 disabled:opacity-60 sm:self-end"
                  onClick={() => void handleFetchQaseProjects()}
                  disabled={loadingQaseProjects || !qaseToken || isViewMode}
                >
                  <FiSearch size={14} />
                  {loadingQaseProjects ? "Buscando..." : "Buscar projetos"}
                </button>
              </div>

              {!qaseToken ? (
                <div className="mt-2 text-sm text-amber-600">Sem token da Qase configurado</div>
              ) : null}

                {qaseProjectsError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {qaseProjectsError}
                  </div>
                ) : null}

                {qaseTestMessage ? (
                  <div className={`mt-2 rounded-md px-3 py-2 text-sm ${qaseTestStatus === "ok" ? "border border-green-200 bg-green-50 text-green-800" : "border border-rose-200 bg-rose-50 text-rose-800"}`}>
                    {qaseTestMessage}
                  </div>
                ) : null}

                {qaseProjects.length > 0 ? (
                  <div className="space-y-4 rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-(--tc-text)"><FiCloudLightning size={14} className="text-(--tc-accent,#ef0001)" /> Projetos encontrados</p>
                        <p className="mt-1 text-xs text-(--tc-text-muted)">Selecione os projetos que deseja vincular — cada projeto vira uma aplicação independente.</p>
                      </div>
                      <div className="text-sm text-(--tc-text-muted)">{Math.min(displayLimit, qaseProjects.filter((p) => {
                        const q = searchProjects.trim().toLowerCase();
                        if (onlyValid && p.status !== "valid") return false;
                        if (!q) return true;
                        return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                      }).length)} carregados • {selectedProjects.length} selecionado{selectedProjects.length !== 1 ? "s" : ""}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted)" />
                        <input value={searchProjects} onChange={(e) => setSearchProjects(e.target.value)} placeholder="Filtrar projetos" className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) pl-10 pr-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)" />
                      </div>
                      <label className="ml-2 flex items-center gap-2 text-xs text-(--tc-text-muted)">
                        <input type="checkbox" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} className="h-4 w-4" />
                        <span>Mostrar apenas válidos</span>
                      </label>
                    </div>

                    <div className="grid gap-2">
                      {(() => {
                        const filtered = qaseProjects.filter((p) => {
                          const q = searchProjects.trim().toLowerCase();
                          if (onlyValid && p.status !== "valid") return false;
                          if (!q) return true;
                          return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                        });
                        const visible = filtered.slice(0, displayLimit);
                        return visible.map((project) => {
                          const isSelected = selectedQaseProjectCodes.includes(project.code);
                          return (
                            <label
                              key={project.code}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm transition border ${isSelected ? "border-2 border-sky-400 bg-sky-50 shadow-[0_8px_20px_rgba(14,165,233,0.12)] dark:border-sky-600 dark:bg-sky-950/35" : "border-transparent hover:border-sky-200 hover:bg-sky-50/65 dark:hover:border-sky-800 dark:hover:bg-sky-950/25"}`}
                            >
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelectedQaseProject(project.code)} className="h-5 w-5" />
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-(--tc-surface-2) text-(--tc-text-muted)"><FiCloudLightning size={14} /></span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="block font-semibold text-(--tc-text)">{project.title}</span>
                                    {project.status && (
                                      <span className={`text-xs font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${project.status === "valid" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : project.status === "invalid" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                                        {project.status === "valid" ? "Válido" : project.status === "invalid" ? "Inválido" : "Pendente"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-xs text-(--tc-text-muted)">{project.code}</span>
                                </div>
                              </div>
                            </label>
                          );
                        });
                      })()}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-(--tc-text-muted)">Exibindo {Math.min(displayLimit, qaseProjects.filter((p) => {
                        const q = searchProjects.trim().toLowerCase();
                        if (onlyValid && p.status !== "valid") return false;
                        if (!q) return true;
                        return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                      }).length)} de {qaseProjects.length} carregados</div>
                      <div className="flex items-center gap-2">
                        {qaseProjects.filter((p) => {
                          const q = searchProjects.trim().toLowerCase();
                          if (onlyValid && p.status !== "valid") return false;
                          if (!q) return true;
                          return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                        }).length > displayLimit ? (
                          <button type="button" onClick={() => setDisplayLimit((d) => d + 10)} className="rounded-md px-3 py-1 text-xs font-semibold text-(--tc-text) hover:bg-(--tc-surface-2)">Carregar mais</button>
                        ) : null}
                        <button type="button" onClick={() => setProjectsOpen(false)} className="rounded-md border px-3 py-1 text-xs font-semibold">Fechar</button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{selectedProjects.length} projeto{selectedProjects.length !== 1 ? "s" : ""} selecionado{selectedProjects.length !== 1 ? "s" : ""}</div>
                        {selectedProjects.length > 0 && <div className="text-xs text-(--tc-text-muted)">{selectedProjects.length} selecionado(s)</div>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {selectedProjects.map((p) => (
                          <span key={p.code} className="inline-flex items-center gap-3 rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm shadow-sm dark:border-sky-700/60 dark:bg-sky-950/35">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sky-600 dark:bg-slate-950/70 dark:text-sky-300"><FiCheck size={14} /></div>
                            <div className="flex flex-col text-left">
                              <strong className="text-sm">{p.title}</strong>
                              <span className="text-xs text-(--tc-text-muted)">{p.code}</span>
                            </div>
                            <button type="button" onClick={() => removeSelectedProject(p.code)} className="ml-2 text-xs text-(--tc-text-muted)">x</button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm">Projeto principal
                          <select
                            className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                            value={qaseProjectCode}
                            onChange={(e) => {
                              const code = e.target.value;
                              setQaseProjectCode(code);
                              setSelectedQaseProjectCodes((current) => (current.includes(code) ? current : [...current, code]));
                            }}
                            disabled={selectedProjects.length === 0}
                          >
                            <option value="">{selectedProjects.length ? "Selecione o projeto principal" : "Selecione primeiro os projetos vinculados"}</option>
                            {selectedProjects.map((project) => (
                              <option key={project.code} value={project.code}>
                                {project.title} ({project.code})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="text-sm font-medium">Aplicações que serão criadas</div>
                        <div className="mt-1 text-xs text-(--tc-text-muted)">{selectedProjects.length} aplicação{selectedProjects.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-4 text-sm text-slate-600 dark:border-sky-700/55 dark:bg-sky-950/30 dark:text-slate-300">
                    <FiSearch size={18} className="shrink-0 text-sky-500" />
                    <span>Informe o token e clique em &quot;Buscar projetos&quot; para selecionar as aplicações da empresa. Cada projeto da Qase será cadastrado como uma aplicação independente.</span>
                  </div>
                )}
              </div>
            

          </fieldset>

          <label className="block text-sm md:col-span-2">
            Descrição curta
            <textarea
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Resumo da empresa"
              disabled={isViewMode}
            />
          </label>

          <label className="block text-sm md:col-span-2">
            Notas internas
            <textarea
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações adicionais"
              disabled={isViewMode}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={isViewMode} />
            Status: {active ? "Ativo" : "Inativo"}
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            onClick={handleCloseOrCancel}
          >
            {isViewMode ? 'Fechar' : 'Cancelar'}
          </button>
          
          {isViewMode && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              onClick={() => setIsEditing(true)}
            >
              <FiEdit2 size={16} />
              Editar
            </button>
          )}
          
          {isEditMode && (
            <button
              type="submit"
              className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              disabled={busy}
            >
              {busy ? "Salvando..." : submitButtonText}
            </button>
          )}
        </div>
        </div>
      </form>
    </div>
  );
}

