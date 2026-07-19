"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BrainSource = {
  id: string;
  name: string;
  description?: string | null;
  sourceType: string;
  provider?: string | null;
  status: string;
  scopeType: string;
  config?: Record<string, unknown>;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  memoriesGenerated?: number;
  lastMemoryAt?: string | null;
  processingStatus?: string;
};

type BrainMemoryItem = {
  id: string;
  title: string;
  summary: string;
  memoryType: string;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: string;
};

type DockType = "external_api" | "external_database" | "public_site" | "free_web" | "internal_wiki" | "file_document" | "webhook" | "github";

type OrbitNode = {
  source: BrainSource;
  radius: number;
  speed: number;
  angle: number;
  size: number;
};

type Particle = { x: number; y: number; t: number; color: string };

const DOCK_ITEMS: Array<{ type: DockType; label: string; icon: string }> = [
  { type: "external_api", label: "API externa", icon: "M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3" },
  { type: "external_database", label: "Banco de dados", icon: "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3m0 0c0-1.7-3.6-3-8-3s-8 1.3-8 3" },
  { type: "public_site", label: "Site público", icon: "M3 12h18M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18z" },
  { type: "free_web", label: "Web livre", icon: "M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" },
  { type: "internal_wiki", label: "Wiki interna", icon: "M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" },
  { type: "file_document", label: "Arquivo", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" },
  { type: "webhook", label: "Webhook", icon: "M18 16.98a3 3 0 1 0-2.83-4H9.83M6 7.02a3 3 0 1 0 2.83 4" },
  { type: "github", label: "GitHub", icon: "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.53 9.53 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .26.18.57.69.48A10 10 0 0 0 12 2z" },
];

const TYPE_LABEL: Record<string, string> = {
  external_api: "API externa",
  external_database: "Banco de dados",
  public_site: "Site público",
  free_web: "Web livre",
  internal_wiki: "Wiki interna",
  file_document: "Arquivo",
  webhook: "Webhook",
  internal_system: "Fonte interna",
};

const CYAN = "34,211,238";
const WARN = "251,191,36";
const IDLE = "95,107,140";

function statusColor(status: string) {
  if (status === "active") return CYAN;
  if (status === "error") return "239,68,68";
  return IDLE;
}

function iconPathFor(sourceType: string, provider?: string | null) {
  if (provider === "github") return DOCK_ITEMS.find((d) => d.type === "github")!.icon;
  const found = DOCK_ITEMS.find((d) => d.type === sourceType);
  return found?.icon ?? DOCK_ITEMS[0].icon;
}

function hashSeed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function dateLabel(value?: string | null) {
  if (!value) return "nunca";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return "agora";
  if (diffH < 24) return `${Math.round(diffH)}h atrás`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `${diffD} dias`;
  return date.toLocaleDateString("pt-BR");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisição");
  return json as T;
}

type FieldDef = { key: string; label: string; type: "text" | "password" | "select" | "number"; placeholder?: string; options?: string[] };

const TYPE_FIELDS: Record<DockType, FieldDef[]> = {
  external_api: [
    { key: "baseUrl", label: "URL base", type: "text", placeholder: "https://api.exemplo.com" },
    { key: "authType", label: "Autenticação", type: "select", options: ["none", "apiKey", "bearer", "basic"] },
    { key: "token", label: "Token / chave", type: "password", placeholder: "••••••••••••" },
  ],
  external_database: [
    { key: "host", label: "Host", type: "text", placeholder: "db.exemplo.com" },
    { key: "databaseName", label: "Database", type: "text", placeholder: "quality_control" },
    { key: "connectionString", label: "String de conexão", type: "password", placeholder: "••••••••••••" },
  ],
  public_site: [
    { key: "baseUrl", label: "URL inicial", type: "text", placeholder: "https://docs.exemplo.com" },
    { key: "crawlDepth", label: "Profundidade", type: "select", options: ["1", "2", "3"] },
  ],
  free_web: [
    { key: "allowedDomains", label: "Domínios permitidos", type: "text", placeholder: "stackoverflow.com, owasp.org" },
  ],
  internal_wiki: [
    { key: "baseUrl", label: "URL da wiki", type: "text", placeholder: "https://wiki.interna/regras" },
  ],
  webhook: [
    { key: "token", label: "Segredo de assinatura", type: "password", placeholder: "••••••••••••" },
  ],
  file_document: [],
  github: [
    { key: "githubOwner", label: "Owner/organização", type: "text", placeholder: "testing-company" },
    { key: "githubRepo", label: "Repositório", type: "text", placeholder: "quality-control" },
    { key: "token", label: "Personal Access Token", type: "password", placeholder: "••••••••••••" },
  ],
};

const SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "user", label: "Só eu" },
  { value: "project", label: "Este projeto" },
  { value: "company", label: "Esta empresa" },
  { value: "global", label: "Global (todas as empresas)" },
];

function sourceDockType(source: BrainSource): DockType {
  if (source.provider === "github") return "github";
  const known: DockType[] = ["external_api", "external_database", "public_site", "free_web", "internal_wiki", "webhook", "file_document"];
  return known.includes(source.sourceType as DockType) ? (source.sourceType as DockType) : "external_api";
}

function prefillFromConfig(source: BrainSource): Record<string, string> {
  const config = (source.config ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const api = config.api ?? {};
  const database = config.database ?? {};
  const web = config.web ?? {};
  const github = config.github ?? {};
  const asText = (value: unknown) => (Array.isArray(value) ? value.join(", ") : value != null ? String(value) : "");
  return {
    name: source.name,
    description: source.description ?? "",
    scopeType: source.scopeType,
    useForGeneralQuestions: String((source as { useForGeneralQuestions?: boolean }).useForGeneralQuestions ?? true),
    useForRagIngestion: String((source as { useForRagIngestion?: boolean }).useForRagIngestion ?? false),
    baseUrl: asText(api.baseUrl ?? web.baseUrl),
    authType: asText(api.authType) || "none",
    host: asText(database.host),
    databaseName: asText(database.databaseName),
    crawlDepth: asText(web.crawlDepth) || "1",
    allowedDomains: asText(web.allowedDomains),
    githubOwner: asText(github.owner),
    githubRepo: asText(github.repo),
  };
}

export function BrainOrbitalConsole() {
  const [sources, setSources] = useState<BrainSource[]>([]);
  const [recentMemories, setRecentMemories] = useState<BrainMemoryItem[]>([]);
  const [requiresMigration, setRequiresMigration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dockType, setDockType] = useState<DockType | null>(null);
  const [createForm, setCreateForm] = useState<Record<string, string>>({ name: "" });
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<OrbitNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const positionsRef = useRef<Array<{ x: number; y: number; r: number }>>([]);
  const hoverRef = useRef<number>(-1);
  const seenMemoryIdsRef = useRef<Set<string>>(new Set());

  const totalMemories = sources.reduce((sum, s) => sum + (s.memoriesGenerated ?? 0), 0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sourceData, memoryData] = await Promise.all([
        fetchJson<{ sources: BrainSource[]; requiresMigration?: boolean; error?: string }>("/api/brain/settings/sources"),
        fetchJson<{ memories?: BrainMemoryItem[] }>("/api/brain/memories?limit=8").catch(() => ({ memories: [] })),
      ]);
      setSources(sourceData.sources ?? []);
      setRequiresMigration(sourceData.requiresMigration === true);
      if (sourceData.requiresMigration && sourceData.error) setError(sourceData.error);
      setRecentMemories(memoryData.memories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o Brain");
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 20000);
    return () => window.clearInterval(interval);
  }, [load]);

  // build deterministic orbit nodes whenever the source list changes
  useEffect(() => {
    nodesRef.current = sources.map((source, index) => {
      const seed = hashSeed(source.id);
      const radius = 120 + (seed % 5) * 34 + (index % 2) * 10;
      const speed = ((seed % 100) / 100 - 0.5) * 0.22 || 0.05;
      const angle = ((seed % 360) / 360) * Math.PI * 2;
      const size = source.processingStatus === "indexado" ? 15 : 12;
      return { source, radius, speed, angle, size };
    });
  }, [sources]);

  // spawn a particle for every memory we haven't shown yet
  useEffect(() => {
    for (const memory of recentMemories) {
      if (seenMemoryIdsRef.current.has(memory.id)) continue;
      seenMemoryIdsRef.current.add(memory.id);
      const node = nodesRef.current.find((n) => n.source.id === memory.sourceId);
      const stage = containerRef.current;
      if (!stage) continue;
      const cx = stage.clientWidth / 2;
      const cy = stage.clientHeight / 2;
      let x = cx + (Math.random() - 0.5) * 260; // NOSONAR: cosmetic particle jitter, not security-sensitive
      let y = cy + (Math.random() - 0.5) * 200; // NOSONAR: cosmetic particle jitter, not security-sensitive
      if (node) {
        x = cx + Math.cos(node.angle) * node.radius;
        y = cy + Math.sin(node.angle) * node.radius * 0.62;
      }
      particlesRef.current.push({ x, y, t: 0, color: CYAN });
    }
  }, [recentMemories]);

  // animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = containerRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = stage!.clientWidth;
      const h = stage!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const w = stage!.clientWidth;
      const h = stage!.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      ctx!.clearRect(0, 0, w, h);

      nodesRef.current.forEach((n) => {
        ctx!.beginPath();
        ctx!.ellipse(cx, cy, n.radius, n.radius * 0.62, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(140,165,210,0.10)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      });

      const pulse = 1 + Math.sin(now / 700) * 0.05;
      const coreR = 44 * pulse;
      const grad = ctx!.createRadialGradient(cx, cy, 4, cx, cy, coreR * 2.4);
      grad.addColorStop(0, `rgba(${CYAN},0.85)`);
      grad.addColorStop(0.35, `rgba(${CYAN},0.25)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fillStyle = "#061422";
      ctx!.fill();
      ctx!.lineWidth = 1.4;
      ctx!.strokeStyle = `rgba(${CYAN},0.9)`;
      ctx!.stroke();

      positionsRef.current = [];
      nodesRef.current.forEach((n, i) => {
        n.angle += n.speed * dt;
        const x = cx + Math.cos(n.angle) * n.radius;
        const y = cy + Math.sin(n.angle) * n.radius * 0.62;
        positionsRef.current.push({ x, y, r: n.size + 6 });

        const col = statusColor(n.source.status);
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(x, y);
        const lg = ctx!.createLinearGradient(cx, cy, x, y);
        lg.addColorStop(0, `rgba(${col},0.32)`);
        lg.addColorStop(1, `rgba(${col},0.04)`);
        ctx!.strokeStyle = lg;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();

        const glow = ctx!.createRadialGradient(x, y, 1, x, y, n.size * 2.6);
        glow.addColorStop(0, `rgba(${col},0.5)`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(x, y, n.size * 2.6, 0, Math.PI * 2);
        ctx!.fill();

        const isHover = i === hoverRef.current;
        ctx!.beginPath();
        ctx!.arc(x, y, isHover ? n.size + 3 : n.size, 0, Math.PI * 2);
        ctx!.fillStyle = "#0a1424";
        ctx!.fill();
        ctx!.lineWidth = isHover ? 2 : 1.2;
        ctx!.strokeStyle = `rgba(${col},1)`;
        ctx!.stroke();
      });

      particlesRef.current.forEach((p) => {
        p.t += dt;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.t < 1.4);
      particlesRef.current.forEach((p) => {
        const k = Math.min(1, p.t / 1.4);
        const x = p.x + (cx - p.x) * k;
        const y = p.y + (cy - p.y) * k;
        ctx!.beginPath();
        ctx!.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${p.color},${1 - k * 0.3})`;
        ctx!.fill();
      });

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    function handleClick(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      let hit = -1;
      positionsRef.current.forEach((p, i) => {
        if (Math.hypot(mx - p.x, my - p.y) < p.r + 6) hit = i;
      });
      if (hit >= 0) {
        setSelectedId(nodesRef.current[hit].source.id);
        setDockType(null);
      }
    }
    function handleMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      let hit = -1;
      positionsRef.current.forEach((p, i) => {
        if (Math.hypot(mx - p.x, my - p.y) < p.r + 6) hit = i;
      });
      hoverRef.current = hit;
      canvas!.style.cursor = hit >= 0 ? "pointer" : "default";
    }
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMove);
    };
  }, []);

  const selectedSource = sources.find((s) => s.id === selectedId) ?? null;

  function openDock(type: DockType) {
    setSelectedId(null);
    setEditingId(null);
    setDockType(type);
    setCreateForm({ name: "", scopeType: "user", useForGeneralQuestions: "true", useForRagIngestion: "false" });
    setCreateFile(null);
    setShowAdvanced(false);
    setFeedback(null);
  }

  function buildSourcePayload(dock: DockType, form: Record<string, string>) {
    const isGithub = dock === "github";
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      sourceType: isGithub ? "external_api" : dock,
      provider: isGithub ? "github" : undefined,
      status: "active",
      scopeType: form.scopeType || "user",
      useForGeneralQuestions: form.useForGeneralQuestions !== "false",
      useForRagIngestion: form.useForRagIngestion === "true",
      ...form,
    };
    const secretValues: Record<string, string> = {};
    if (form.token) secretValues.token = form.token;
    if (form.connectionString) secretValues.connectionString = form.connectionString;
    if (Object.keys(secretValues).length) payload.secretValues = secretValues;
    return payload;
  }

  async function submitCreate() {
    if (!dockType) return;
    setSaving(true);
    setError(null);
    try {
      if (dockType === "file_document") {
        if (!createFile) throw new Error("Selecione um arquivo");
        const body = new FormData();
        body.append("file", createFile);
        body.append("name", createForm.name || createFile.name);
        body.append("scopeType", createForm.scopeType || "user");
        const response = await fetch("/api/brain/settings/sources/import", { method: "POST", credentials: "include", body });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha ao importar arquivo");
        setFeedback(`Importado: ${json.source?.name ?? createFile.name}`);
      } else {
        await fetchJson("/api/brain/settings/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildSourcePayload(dockType, createForm)),
        });
        setFeedback(`Fonte "${createForm.name}" conectada.`);
      }
      setDockType(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar fonte");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(source: BrainSource) {
    setDockType(null);
    setEditingId(source.id);
    setEditForm(prefillFromConfig(source));
    setShowAdvanced(false);
    setFeedback(null);
  }

  async function submitEdit() {
    if (!editingId) return;
    const source = sources.find((s) => s.id === editingId);
    if (!source) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/brain/settings/sources/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSourcePayload(sourceDockType(source), editForm)),
      });
      setFeedback(`Fonte "${editForm.name}" atualizada.`);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar fonte");
    } finally {
      setSaving(false);
    }
  }

  async function sourceAction(source: BrainSource, action: "enable" | "disable" | "test") {
    setError(null);
    setFeedback(null);
    try {
      const data = await fetchJson<{ result?: { message?: string } }>(`/api/brain/settings/sources/${encodeURIComponent(source.id)}/${action}`, { method: "POST" });
      setFeedback(action === "test" ? `Teste concluído: ${data.result?.message ?? "ok"}` : action === "enable" ? "Fonte ativada." : "Fonte desativada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na ação da fonte");
    }
  }

  const activeCount = sources.filter((s) => s.status === "active").length;
  const pendingReview = sources.filter((s) => s.status === "error" || s.processingStatus === "erro").length;
  const lastMemoryAt = sources
    .map((s) => s.lastMemoryAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))
    .at(-1);

  return (
    <div ref={containerRef} className="relative h-[calc(100vh-64px)] min-h-[640px] w-full overflow-hidden bg-[#020713] text-[#eaf1fb]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, rgba(34,211,238,.10), transparent 32%), radial-gradient(circle at 82% 14%, rgba(239,0,1,.10), transparent 30%), radial-gradient(circle at 12% 82%, rgba(34,211,238,.07), transparent 34%), linear-gradient(160deg, #020713 0%, #050b1c 70%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      <div className="pointer-events-none absolute left-6 right-6 top-6 z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300">
            <span className="h-[5px] w-[5px] rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
            BRAIN · NÚCLEO DE MEMÓRIA
          </div>
          <h1 className="mt-1.5 text-xl font-extrabold tracking-tight">O que ele sabe agora</h1>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <b className="block font-mono text-[19px] tabular-nums">{totalMemories}</b>
            <span className="text-[9.5px] uppercase tracking-[0.08em] text-slate-500">memórias</span>
          </div>
          <div>
            <b className="block font-mono text-[19px] tabular-nums">{activeCount}</b>
            <span className="text-[9.5px] uppercase tracking-[0.08em] text-slate-500">fontes ativas</span>
          </div>
          <div>
            <b className="block font-mono text-[19px] tabular-nums">{pendingReview}</b>
            <span className="text-[9.5px] uppercase tracking-[0.08em] text-slate-500">com erro</span>
          </div>
        </div>
      </div>

      {!sources.length ? (
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-10 -translate-x-1/2 text-center">
          <p className="font-mono text-[26px] font-semibold">{totalMemories}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-cyan-300">memórias no núcleo</p>
          <p className="mt-3 text-xs text-slate-500">Nenhuma fonte conectada ainda — clique num ícone abaixo.</p>
        </div>
      ) : null}

      {requiresMigration ? (
        <p className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          Migration de fontes do Brain ainda não aplicada.
        </p>
      ) : null}
      {error ? (
        <p className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-2 text-xs text-red-100">{error}</p>
      ) : null}

      {/* detail panel */}
      {selectedSource ? (
        <aside className="absolute right-6 top-[92px] z-20 w-[290px] rounded-2xl border border-[#1c2c4a] bg-[#0a1326]/90 p-4 backdrop-blur">
          <button type="button" onClick={() => setSelectedId(null)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-200">✕</button>
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#0b1424]">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className="h-4 w-4 stroke-cyan-300"><path d={iconPathFor(selectedSource.sourceType, selectedSource.provider)} /></svg>
            </span>
            <div>
              <strong className="block text-[13.5px]">{selectedSource.name}</strong>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-slate-500">{TYPE_LABEL[selectedSource.sourceType] ?? selectedSource.sourceType}</span>
            </div>
          </div>
          <span
            className="mb-2.5 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.05em]"
            style={{
              background: selectedSource.status === "active" ? "rgba(52,211,153,.14)" : selectedSource.status === "error" ? "rgba(251,113,133,.14)" : "rgba(95,107,140,.14)",
              color: selectedSource.status === "active" ? "#34d399" : selectedSource.status === "error" ? "#fb7185" : "#8fa0c2",
            }}
          >
            {selectedSource.status === "active" ? "ativa" : selectedSource.status === "error" ? "erro" : selectedSource.status}
          </span>
          <p className="mb-3 text-xs leading-relaxed text-slate-400">{selectedSource.description || "Sem descrição."}</p>
          {selectedSource.lastErrorMessage ? <p className="mb-3 text-xs text-rose-300">{selectedSource.lastErrorMessage}</p> : null}
          <div className="mb-3 flex gap-4">
            <div>
              <b className="block font-mono text-base">{selectedSource.memoriesGenerated ?? 0}</b>
              <span className="text-[9.5px] uppercase tracking-[0.05em] text-slate-500">memórias</span>
            </div>
            <div>
              <b className="block font-mono text-base">{dateLabel(selectedSource.lastMemoryAt)}</b>
              <span className="text-[9.5px] uppercase tracking-[0.05em] text-slate-500">último consumo</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => sourceAction(selectedSource, "test")} className="rounded-lg border border-[#1c2c4a] px-3 py-1.5 text-xs font-bold text-cyan-200 hover:border-cyan-300/60">Testar</button>
            <button type="button" onClick={() => sourceAction(selectedSource, selectedSource.status === "active" ? "disable" : "enable")} className="rounded-lg border border-[#1c2c4a] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-400">
              {selectedSource.status === "active" ? "Desativar" : "Ativar"}
            </button>
            <button type="button" onClick={() => startEdit(selectedSource)} className="rounded-lg border border-[#1c2c4a] px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-slate-400">
              Configurar
            </button>
          </div>
        </aside>
      ) : null}

      {/* create / edit panel */}
      {dockType || editingId ? (() => {
        const isEdit = Boolean(editingId);
        const dock = isEdit ? sourceDockType(sources.find((s) => s.id === editingId)!) : dockType!;
        const form = isEdit ? editForm : createForm;
        const setForm = isEdit ? setEditForm : setCreateForm;
        const dockMeta = DOCK_ITEMS.find((d) => d.type === dock);
        const onClose = () => (isEdit ? setEditingId(null) : setDockType(null));
        const onSubmit = isEdit ? submitEdit : submitCreate;
        return (
          <aside className="absolute right-6 top-[92px] z-20 w-[300px] rounded-2xl border border-[#1c2c4a] bg-[#0a1326]/90 p-4 backdrop-blur">
            <button type="button" onClick={onClose} className="absolute right-3 top-3 text-slate-500 hover:text-slate-200">✕</button>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[#0b1424]">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className="h-4 w-4 stroke-cyan-300"><path d={dockMeta?.icon} /></svg>
              </span>
              <strong className="text-[13.5px]">{isEdit ? `Configurar: ${dockMeta?.label}` : dockMeta?.label}</strong>
            </div>
            <div className="grid gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-slate-500">Nome</label>
                <input
                  value={form.name ?? ""}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Ex.: API de biometria Griaule"
                  className="rounded-md border border-[#1c2c4a] bg-[#111a2c] px-2.5 py-2 text-[13px] outline-none"
                />
              </div>
              {dock === "file_document" && !isEdit ? (
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-slate-500">Arquivo (.txt, .md, .json, .csv, .xlsx)</label>
                  <input type="file" accept=".txt,.md,.json,.csv,.xlsx,.xls" onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)} className="text-xs text-slate-300" />
                </div>
              ) : (
                TYPE_FIELDS[dock].map((field) => (
                  <div key={field.key} className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-slate-500">{field.label}</label>
                    {field.type === "select" ? (
                      <select value={form[field.key] ?? field.options?.[0]} onChange={(e) => setForm((c) => ({ ...c, [field.key]: e.target.value }))} className="rounded-md border border-[#1c2c4a] bg-[#111a2c] px-2.5 py-2 text-[13px] outline-none">
                        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={form[field.key] ?? ""}
                        onChange={(e) => setForm((c) => ({ ...c, [field.key]: e.target.value }))}
                        placeholder={isEdit && field.type === "password" ? "Deixe em branco para manter" : field.placeholder}
                        className="rounded-md border border-[#1c2c4a] bg-[#111a2c] px-2.5 py-2 text-[13px] outline-none"
                      />
                    )}
                  </div>
                ))
              )}
              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mt-1 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-cyan-300">
                {showAdvanced ? "− Menos configurações" : "+ Mais configurações"}
              </button>
              {showAdvanced ? (
                <div className="grid gap-2.5 rounded-lg border border-[#1c2c4a] bg-[#0b1424] p-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-slate-500">Descrição</label>
                    <textarea
                      value={form.description ?? ""}
                      onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                      placeholder="Para que serve esta fonte"
                      rows={2}
                      className="rounded-md border border-[#1c2c4a] bg-[#111a2c] px-2.5 py-2 text-[13px] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-slate-500">Alcance</label>
                    <select value={form.scopeType ?? "user"} onChange={(e) => setForm((c) => ({ ...c, scopeType: e.target.value }))} className="rounded-md border border-[#1c2c4a] bg-[#111a2c] px-2.5 py-2 text-[13px] outline-none">
                      {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.useForGeneralQuestions !== "false"}
                      onChange={(e) => setForm((c) => ({ ...c, useForGeneralQuestions: String(e.target.checked) }))}
                    />
                    Usar para responder perguntas gerais
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={form.useForRagIngestion === "true"}
                      onChange={(e) => setForm((c) => ({ ...c, useForRagIngestion: String(e.target.checked) }))}
                    />
                    Ingerir conteúdo para memórias (RAG)
                  </label>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              {dock === "file_document" && !isEdit ? "PDF e DOCX ainda não são suportados." : "Segredos ficam só no backend, nunca aparecem depois de salvos."}
            </p>
            <button type="button" onClick={onSubmit} disabled={saving || !form.name} className="mt-3 w-full rounded-lg bg-cyan-300 py-2 text-[13px] font-black text-slate-950 disabled:opacity-50">
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Conectar fonte"}
            </button>
          </aside>
        );
      })() : null}

      {feedback ? (
        <p className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100">{feedback}</p>
      ) : null}

      {/* ticker */}
      <div className="absolute bottom-5 left-6 z-10 w-[min(360px,30vw)]">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">Aprendido recentemente</h3>
        <div className="flex flex-col gap-1.5">
          {recentMemories.slice(0, 3).map((memory) => (
            <div key={memory.id} className="rounded-lg border border-[#1c2c4a] bg-[#0a1326]/80 px-3 py-2 backdrop-blur">
              <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-cyan-300">{memory.memoryType}</span>
              <p className="mt-0.5 text-[11.5px] leading-snug text-slate-100">{memory.title}</p>
            </div>
          ))}
          {!recentMemories.length ? <p className="text-xs text-slate-500">Nada aprendido ainda.</p> : null}
        </div>
      </div>

      {/* dock */}
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-[14px] border border-[#1c2c4a] bg-[#0a1326]/90 p-2 backdrop-blur">
        {DOCK_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            title={item.label}
            onClick={() => openDock(item.type)}
            className={`grid h-10 w-10 place-items-center rounded-[10px] border transition ${dockType === item.type ? "border-cyan-300/70 bg-cyan-300/10" : "border-[#1c2c4a] bg-[#0b1424] hover:border-cyan-300/50"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`h-[17px] w-[17px] ${dockType === item.type ? "stroke-cyan-300" : "stroke-slate-400"}`}><path d={item.icon} /></svg>
          </button>
        ))}
      </div>

      <p className="pointer-events-none absolute bottom-[68px] left-1/2 -translate-x-1/2 text-[11px] text-slate-500">Adicionar fonte</p>
      {lastMemoryAt ? (
        <p className="pointer-events-none absolute bottom-5 right-6 z-10 text-[10.5px] text-slate-500">Última memória: {dateLabel(lastMemoryAt)}</p>
      ) : null}
    </div>
  );
}
