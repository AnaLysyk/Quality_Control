"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { FiChevronDown, FiChevronUp, FiImage, FiSearch, FiUpload, FiUser, FiX } from "react-icons/fi";

export type AvatarLibraryChoice = {
  avatarKind: "emoji" | "gif" | "default" | "image";
  avatarValue: string;
  avatarLabel: string;
};

type AvatarLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  kind: AvatarLibraryChoice["avatarKind"];
  onSelect: (choice: AvatarLibraryChoice) => void;
};

type LibraryItem = {
  kind: AvatarLibraryChoice["avatarKind"];
  value: string;
  label: string;
  keywords: string;
  group: "icons" | "gifs" | "emoji";
};

const INITIAL_GIF_COUNT = 18;
const GIF_PAGE_SIZE = 14;

function brandAvatar(label: string, bg: string, fg = "#ffffff") {
  const initials = label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <radialGradient id="g" cx="30%" cy="20%" r="90%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".35"/>
          <stop offset="42%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="#071a44"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#g)"/>
      <circle cx="90" cy="28" r="18" fill="#ffffff" opacity=".12"/>
      <text x="60" y="70" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="${fg}">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}

const ICON_LIBRARY: LibraryItem[] = [
  { kind: "default", value: "", label: "Perfil sem foto", keywords: "usuario padrao sem foto boneco pessoa", group: "icons" },
  { kind: "image", value: brandAvatar("GitHub", "#181717"), label: "GitHub", keywords: "github dev codigo repositorio", group: "icons" },
  { kind: "image", value: brandAvatar("GitLab", "#FC6D26"), label: "GitLab", keywords: "gitlab dev codigo repositorio", group: "icons" },
  { kind: "image", value: brandAvatar("Jira", "#0052CC"), label: "Jira", keywords: "jira gestao chamados projeto", group: "icons" },
  { kind: "image", value: brandAvatar("Slack", "#4A154B"), label: "Slack", keywords: "slack chat comunicacao", group: "icons" },
  { kind: "image", value: brandAvatar("Figma", "#F24E1E"), label: "Figma", keywords: "figma design ui ux", group: "icons" },
  { kind: "image", value: brandAvatar("Notion", "#000000"), label: "Notion", keywords: "notion docs organizacao", group: "icons" },
  { kind: "image", value: brandAvatar("Google", "#4285F4"), label: "Google", keywords: "google workspace conta", group: "icons" },
  { kind: "image", value: brandAvatar("LinkedIn", "#0A66C2"), label: "LinkedIn", keywords: "linkedin profissional rede social", group: "icons" },
  { kind: "image", value: brandAvatar("Teams", "#6264A7"), label: "Teams", keywords: "teams microsoft reuniao", group: "icons" },
  { kind: "image", value: brandAvatar("React", "#149ECA"), label: "React", keywords: "react frontend dev", group: "icons" },
  { kind: "image", value: brandAvatar("Python", "#3776AB"), label: "Python", keywords: "python automacao qa dev", group: "icons" },
  { kind: "image", value: brandAvatar("PostgreSQL", "#4169E1"), label: "PostgreSQL", keywords: "postgres banco dados", group: "icons" },
  { kind: "image", value: brandAvatar("Docker", "#2496ED"), label: "Docker", keywords: "docker infra container", group: "icons" },
  { kind: "image", value: brandAvatar("AWS", "#232F3E"), label: "AWS", keywords: "aws cloud infraestrutura", group: "icons" },
  { kind: "image", value: brandAvatar("QA", "#EF0001"), label: "QA", keywords: "qa qualidade teste", group: "icons" },
  { kind: "image", value: brandAvatar("Admin", "#011848"), label: "Admin", keywords: "admin acesso gestor", group: "icons" },
  { kind: "image", value: brandAvatar("Suporte", "#0284C7"), label: "Suporte", keywords: "suporte atendimento", group: "icons" },
  { kind: "image", value: brandAvatar("Dados", "#7C3AED"), label: "Dados", keywords: "dados metricas relatorio", group: "icons" },
];

const GIF_LIBRARY: LibraryItem[] = [
  { kind: "gif", value: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", label: "Cat typing", keywords: "gato digitando meme trabalho", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif", label: "Cat computer", keywords: "gato computador digitando", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif", label: "Happy cat", keywords: "gato feliz meme", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif", label: "Dev focus", keywords: "dev codigo foco", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/qgQUggAC3Pfv687qPC/giphy.gif", label: "Coding", keywords: "programacao computador codigo", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/LMt9638dO8dftAjtco/giphy.gif", label: "Python coding", keywords: "python automacao qa dev", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3oKIPtjElfqwMOTbH2/giphy.gif", label: "Rocket launch", keywords: "rocket lancamento", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif", label: "Tech loop", keywords: "tech tecnologia loop", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif", label: "Nice", keywords: "nice meme ok aprovado", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif", label: "Done", keywords: "feito done sucesso", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif", label: "Celebration", keywords: "celebracao sucesso aprovado", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif", label: "Teamwork", keywords: "time equipe colaboracao", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3o7abB06u9bNzA8lu8/giphy.gif", label: "Thumbs up", keywords: "ok aprovado positivo", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif", label: "Data flow", keywords: "dados tecnologia fluxo", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/coxQHKASG60HrHtvkt/giphy.gif", label: "Security", keywords: "seguranca acesso escudo", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/fwbZnTftCXVocKzfxR/giphy.gif", label: "Focus", keywords: "foco trabalho produtividade", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif", label: "AI assistant", keywords: "ia robo assistente brain", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26xBwdIuRJiAIqHwA/giphy.gif", label: "Laptop work", keywords: "notebook trabalho computador", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif", label: "Robot", keywords: "robo tech brain", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/ZVik7pBtu9dNS/giphy.gif", label: "Hacker code", keywords: "hacker codigo terminal", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/VTtANKl0beDFQRLDTh/giphy.gif", label: "Working hard", keywords: "trabalho foco", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/10zxDv7Hv5RF9C/giphy.gif", label: "Thinking", keywords: "pensando analise", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/ule4vhcY1xEKQ/giphy.gif", label: "Hello", keywords: "ola hello aceno", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif", label: "Approval vibe", keywords: "aprovacao sucesso meme", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3orieYvhT5EVfSFyBa/giphy.gif", label: "Office vibes", keywords: "office escritorio trabalho", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/l46CwEYnbFtFfjZNS/giphy.gif", label: "Minions wow", keywords: "minions meme wow", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/8Fen5LSZcHQ5O/giphy.gif", label: "Panda computer", keywords: "panda computador meme", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif", label: "Typing fast", keywords: "digitando rapido computador", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", label: "Brain loading", keywords: "pensando carregando brain", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif", label: "Computer work", keywords: "computador trabalho foco", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", label: "Mind blown", keywords: "surpresa ideia insight", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", label: "Success dance", keywords: "sucesso danca aprovado", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif", label: "Review", keywords: "revisao olhando analise", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/12XDYvMJNcmLgQ/giphy.gif", label: "Approved", keywords: "aprovado legal sucesso", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26FPy3QZQqGtDcrja/giphy.gif", label: "Checklist", keywords: "checklist tarefa feito", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/4T7e4DmcrP9du/giphy.gif", label: "Tech cat", keywords: "gato tech meme", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif", label: "Excited", keywords: "animado feliz", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/OkJat1YNdoD3W/giphy.gif", label: "Good job", keywords: "bom trabalho sucesso", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3o6ZsYzuLyRfSGX4f6/giphy.gif", label: "Process", keywords: "processo sistema", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/l0HlRnAWXxn0MhKLK/giphy.gif", label: "Monitoring", keywords: "monitoramento observando", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/xUPGcguWZHRC2HyBRS/giphy.gif", label: "Typing office", keywords: "escritorio digitando", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3o85xGocUH8RYoDKKs/giphy.gif", label: "Idea", keywords: "ideia lampada insight", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif", label: "Data", keywords: "dados relatorio", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3oKIPEqDGUULpEU0aQ/giphy.gif", label: "Charts", keywords: "grafico indicador metrica", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/xT9C25UNTwfZuk85WP/giphy.gif", label: "Support", keywords: "suporte ajuda atendimento", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif", label: "Decision", keywords: "decisao aprovar recusar", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif", label: "Workflow", keywords: "fluxo processo trabalho", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/3oEjHWXddcCOGZNmFO/giphy.gif", label: "Shield", keywords: "seguranca protecao acesso", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif", label: "Rocket", keywords: "rocket entrega agilidade", group: "gifs" },
  { kind: "gif", value: "https://media.giphy.com/media/26ufmYaTU5jqtkmuQ/giphy.gif", label: "Done loop", keywords: "feito finalizado sucesso", group: "gifs" },
];

const EMOJI_LIBRARY: LibraryItem[] = [
  { kind: "emoji", value: "\u{1F464}", label: "Usuario", keywords: "usuario pessoa perfil", group: "emoji" },
  { kind: "emoji", value: "\u{1F9D1}\u200D\u{1F4BB}", label: "Dev", keywords: "dev tecnologia codigo", group: "emoji" },
  { kind: "emoji", value: "\u{1F9EA}", label: "QA", keywords: "qa teste qualidade", group: "emoji" },
  { kind: "emoji", value: "\u{1F6E1}\uFE0F", label: "Seguranca", keywords: "seguranca acesso admin", group: "emoji" },
  { kind: "emoji", value: "\u{1F3E2}", label: "Empresa", keywords: "empresa cliente negocio", group: "emoji" },
  { kind: "emoji", value: "\u{1F4CA}", label: "Dados", keywords: "dados metricas dashboard", group: "emoji" },
  { kind: "emoji", value: "\u{1F680}", label: "Launch", keywords: "rocket lancamento agilidade", group: "emoji" },
  { kind: "emoji", value: "\u2B50", label: "Destaque", keywords: "estrela favorito destaque", group: "emoji" },
  { kind: "emoji", value: "\u2705", label: "Aprovado", keywords: "check aprovado sucesso", group: "emoji" },
  { kind: "emoji", value: "\u{1F50D}", label: "Analise", keywords: "busca analise revisar", group: "emoji" },
  { kind: "emoji", value: "\u{1F4DD}", label: "Documento", keywords: "documento texto anotacao", group: "emoji" },
  { kind: "emoji", value: "\u{1F916}", label: "Assistente", keywords: "robo ia assistente", group: "emoji" },
];

const LIBRARY = [...ICON_LIBRARY, ...GIF_LIBRARY, ...EMOJI_LIBRARY];

function matchesSearch(item: LibraryItem, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${item.label} ${item.keywords}`.toLowerCase().includes(term);
}

function itemIsActive(item: LibraryItem, kind: AvatarLibraryChoice["avatarKind"], value: string) {
  return item.kind === kind && item.value === value;
}

function AvatarTilePreview({ item }: { item: LibraryItem }) {
  const [broken, setBroken] = useState(false);

  if (item.kind === "default") return <FiUser className="h-7 w-7" />;
  if (item.kind === "emoji") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
        <span className="block translate-y-[1px] text-2xl leading-none">{item.value}</span>
      </div>
    );
  }
  if (broken) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-50 text-slate-400">
        <FiImage className="h-5 w-5" />
      </div>
    );
  }

  return (
    <span className="relative block h-full w-full overflow-hidden rounded-full bg-slate-100">
      {item.kind === "gif" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.value}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-125 rounded-full object-cover object-center opacity-30 blur-sm"
          onError={() => setBroken(true)}
        />
      ) : null}
      {item.kind === "gif" ? (
        <span className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.value}
            alt=""
            loading="lazy"
            className="h-full w-full scale-110 object-cover object-center"
            onError={() => setBroken(true)}
          />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.value}
          alt=""
          loading="lazy"
          className="relative z-10 h-full w-full rounded-full object-cover object-center"
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}

export function AvatarLibraryDialog({
  open,
  onOpenChange,
  value,
  kind,
  onSelect,
}: AvatarLibraryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [visibleGifCount, setVisibleGifCount] = useState(INITIAL_GIF_COUNT);

  const filtered = useMemo(() => LIBRARY.filter((item) => matchesSearch(item, search)), [search]);
  const groups = {
    icons: filtered.filter((item) => item.group === "icons"),
    gifs: filtered.filter((item) => item.group === "gifs"),
    emoji: filtered.filter((item) => item.group === "emoji"),
  };

  const visibleGifs = search.trim() ? groups.gifs : groups.gifs.slice(0, visibleGifCount);
  const hiddenGifCount = Math.max(groups.gifs.length - visibleGifs.length, 0);
  const hasExpandedGifs = !search.trim() && visibleGifCount > INITIAL_GIF_COUNT;

  function select(choice: AvatarLibraryChoice) {
    onSelect(choice);
    onOpenChange(false);
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const nextValue = String(reader.result || "");
      if (!nextValue) return;
      select({
        avatarKind: "image",
        avatarValue: nextValue,
        avatarLabel: file.name || "Foto do perfil",
      });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function applyGifUrl() {
    const nextValue = gifUrl.trim();
    if (!nextValue) return;
    select({
      avatarKind: "gif",
      avatarValue: nextValue,
      avatarLabel: "GIF do perfil",
    });
  }

  function renderGroup(title: string, items: LibraryItem[]) {
    if (!items.length) return null;
    return (
      <section>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
          {items.map((item) => {
            const active = itemIsActive(item, kind, value);
            return (
              <button
                key={`${item.kind}-${item.label}-${item.value}`}
                type="button"
                onClick={() => select({ avatarKind: item.kind, avatarValue: item.value, avatarLabel: item.label })}
                className={`group flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-full border bg-white text-[var(--tc-primary)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] ${
                  active ? "border-sky-400 ring-4 ring-sky-100" : "border-slate-200"
                }`}
                title={item.label}
                aria-label={`Selecionar ${item.label}`}
              >
                <AvatarTilePreview item={item} />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-slate-950/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[151] w-[min(720px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_34px_90px_rgba(15,23,42,0.34)] [color-scheme:light]">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[linear-gradient(135deg,var(--tc-primary,#011848)_0%,#071a44_56%,rgba(239,0,1,0.82)_150%)] px-5 py-4 text-white">
            <div>
              <Dialog.Title className="text-lg font-black tracking-tight text-white">Biblioteca de avatar</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-white/85">
                Escolha um icone, GIF, meme ou envie uma imagem do computador.
              </Dialog.Description>
            </div>
            <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20" aria-label="Fechar biblioteca">
              <FiX className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="max-h-[calc(100dvh-180px)] space-y-5 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por GitHub, QA, meme, dados, empresa..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <FiUpload />
                Upload
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Selecionar imagem de avatar no computador"
              title="Selecionar imagem de avatar no computador"
              onChange={handleImageUpload}
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <FiImage className="shrink-0 text-slate-500" />
                <input
                  value={gifUrl}
                  onChange={(event) => setGifUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyGifUrl();
                    }
                  }}
                  placeholder="Cole uma URL de GIF/meme e pressione Enter"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={applyGifUrl}
                  className="rounded-xl bg-[var(--tc-primary)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white"
                >
                  Usar
                </button>
              </label>
            </div>

            {renderGroup("Icones modernos", groups.icons)}

            {visibleGifs.length ? (
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    GIFs e memes
                  </p>
                  {!search.trim() && groups.gifs.length > INITIAL_GIF_COUNT ? (
                    <div className="flex items-center gap-2">
                      {hasExpandedGifs ? (
                        <button
                          type="button"
                          onClick={() => setVisibleGifCount(INITIAL_GIF_COUNT)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        >
                          <FiChevronUp />
                          Ver menos
                        </button>
                      ) : null}
                      {hiddenGifCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setVisibleGifCount((current) => Math.min(current + GIF_PAGE_SIZE, groups.gifs.length))}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        >
                          <FiChevronDown />
                          Ver mais {Math.min(GIF_PAGE_SIZE, hiddenGifCount)}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                  {visibleGifs.map((item) => {
                    const active = itemIsActive(item, kind, value);
                    return (
                      <button
                        key={`${item.kind}-${item.label}-${item.value}`}
                        type="button"
                        onClick={() => select({ avatarKind: item.kind, avatarValue: item.value, avatarLabel: item.label })}
                        className={`group flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-full border bg-white text-[var(--tc-primary)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.10)] ${
                          active ? "border-sky-400 ring-4 ring-sky-100" : "border-slate-200"
                        }`}
                        title={item.label}
                        aria-label={`Selecionar ${item.label}`}
                      >
                        <AvatarTilePreview item={item} />
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {renderGroup("Emojis", groups.emoji)}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

