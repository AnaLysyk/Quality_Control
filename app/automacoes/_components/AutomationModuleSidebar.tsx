"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiClipboard,
  FiCode,
  FiFolder,
  FiGrid,
  FiHash,
  FiList,
  FiServer,
  FiTool,
  FiX,
} from "react-icons/fi";

type NavItem = { href: string; icon: typeof FiTool; label: string; sublabel: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/automacoes/tools",      icon: FiTool,      label: "Tools",      sublabel: "Hub"     },
  { href: "/automacoes/playwright", icon: FiCode,      label: "Playwright", sublabel: "IDE"     },
  { href: "/automacoes/api-lab",    icon: FiServer,    label: "API Lab",    sublabel: "Postman" },
  { href: "/automacoes/casos",      icon: FiClipboard, label: "Casos",      sublabel: "Testes"  },
  { href: "/automacoes/arquivos",   icon: FiFolder,    label: "Documentos", sublabel: "Assets"  },
  { href: "/automacoes/base64",     icon: FiHash,      label: "Base64",     sublabel: "Encode"  },
  { href: "/automacoes/execucoes",  icon: FiActivity,  label: "Execuções",  sublabel: "Runs"    },
  { href: "/automacoes/logs",       icon: FiList,      label: "Logs",       sublabel: "Console" },
];

const POS_KEY   = "automation-fab-pos-v2";
const HINTS_KEY = "automation-fab-hints-seen";
const FAB_SIZE  = 52;

function clampPos(x: number, y: number) {
  return {
    x: Math.max(8, Math.min(window.innerWidth  - FAB_SIZE - 8, x)),
    y: Math.max(8, Math.min(window.innerHeight - FAB_SIZE - 8, y)),
  };
}

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p.x === "number" && typeof p.y === "number") return p;
    }
  } catch { /* ignore */ }
  return { x: 96, y: window.innerHeight - 76 };
}

// ── Delta-based drag (zoom-independent) ──────────────────────────────────────

function useDrag(
  onDelta: (dx: number, dy: number) => void,
  onEnd: () => void,
) {
  const prev   = useRef({ x: 0, y: 0 });
  const moved  = useRef(false);

  const startMouse = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    moved.current = false;
    prev.current  = { x: e.clientX, y: e.clientY };

    const mv = (ev: MouseEvent) => {
      moved.current = true;
      onDelta(ev.clientX - prev.current.x, ev.clientY - prev.current.y);
      prev.current = { x: ev.clientX, y: ev.clientY };
    };
    const up = () => { onEnd(); document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  }, [onDelta, onEnd]);

  const startTouch = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    moved.current = false;
    prev.current  = { x: t.clientX, y: t.clientY };

    const mv = (ev: TouchEvent) => {
      moved.current = true;
      const tt = ev.touches[0];
      onDelta(tt.clientX - prev.current.x, tt.clientY - prev.current.y);
      prev.current = { x: tt.clientX, y: tt.clientY };
    };
    const end = () => { onEnd(); document.removeEventListener("touchmove", mv); document.removeEventListener("touchend", end); };
    document.addEventListener("touchmove", mv, { passive: false });
    document.addEventListener("touchend", end);
  }, [onDelta, onEnd]);

  return { startMouse, startTouch, wasMoved: () => moved.current };
}

// ── Grip dots ─────────────────────────────────────────────────────────────────

function Grip() {
  return (
    <span className="flex flex-col gap-0.75 opacity-50">
      {[0, 1].map(r => (
        <span key={r} className="flex gap-0.75">
          {[0, 1, 2].map(c => <span key={c} className="h-0.75 w-0.75 rounded-full bg-white" />)}
        </span>
      ))}
    </span>
  );
}

// ── Floating hint pill ────────────────────────────────────────────────────────

function HintPill({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <div className={`
      pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2
      flex items-center gap-1.5 whitespace-nowrap
      rounded-full border border-(--tc-border,#d7deea)
      bg-(--tc-surface,#ffffff)
      px-3 py-1.5 shadow-lg
      text-[11px] font-medium text-(--tc-text,#0b1a3c)
      transition-all duration-200
      ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}
    `}>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AutomationModuleSidebar() {
  const pathname = usePathname();
  const [open,       setOpen]       = useState(false);
  const [pos,        setPos]        = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hovered,    setHovered]    = useState(false);
  const [hintStep,   setHintStep]   = useState(0); // 0=hidden,1=click,2=drag,3=done
  const [firstOpen,  setFirstOpen]  = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const outerRef   = useRef<HTMLDivElement>(null);

  /* ── init ── */
  useLayoutEffect(() => {
    setPos(loadPos());
    const seen = localStorage.getItem(HINTS_KEY);
    if (!seen) setHintStep(1); // show first hint
  }, []);

  /* ── persist pos ── */
  useEffect(() => {
    if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  /* ── apply pos via DOM ref ── */
  useLayoutEffect(() => {
    if (!wrapperRef.current || !pos) return;
    wrapperRef.current.style.left = `${pos.x}px`;
    wrapperRef.current.style.top  = `${pos.y}px`;
  }, [pos]);

  /* ── hint sequence: hover → show click hint → 2s → drag hint → 2s → done ── */
  useEffect(() => {
    if (hintStep === 0 || hintStep === 3) return;
    if (!hovered && hintStep === 1) return; // wait for hover
    const t = setTimeout(() => {
      if (hintStep === 1) setHintStep(2);
      else if (hintStep === 2) { setHintStep(3); localStorage.setItem(HINTS_KEY, "1"); }
    }, 2200);
    return () => clearTimeout(t);
  }, [hintStep, hovered]);

  useEffect(() => {
    if (hovered && hintStep === 1) { /* already showing */ }
    if (!hovered && hintStep === 1) setHintStep(1); // keep until interacted
  }, [hovered, hintStep]);

  /* ── close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (outerRef.current && !outerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const h = () => setPos(p => p ? clampPos(p.x, p.y) : p);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  /* ── drag ── */
  const applyDelta = useCallback((dx: number, dy: number) => {
    setPos(p => p ? clampPos(p.x + dx, p.y + dy) : p);
    setHintStep(3); // dismiss hints once dragged
    localStorage.setItem(HINTS_KEY, "1");
  }, []);
  const onEnd = useCallback(() => setIsDragging(false), []);

  const fabDrag    = useDrag(applyDelta, onEnd);
  const headerDrag = useDrag(applyDelta, onEnd);

  const onFabMD = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    fabDrag.startMouse(e);
  }, [fabDrag]);

  const onFabTS = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    fabDrag.startTouch(e);
  }, [fabDrag]);

  const onHeaderMD = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    headerDrag.startMouse(e);
  }, [headerDrag]);

  const onHeaderTS = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    headerDrag.startTouch(e);
  }, [headerDrag]);

  const onFabClick = useCallback(() => {
    if (fabDrag.wasMoved()) return;
    setOpen(v => {
      if (!v) setFirstOpen(true);
      return !v;
    });
    setHintStep(3);
    localStorage.setItem(HINTS_KEY, "1");
  }, [fabDrag]);

  const activeItem = NAV_ITEMS.find(
    item => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget || !pos) return null;

  return createPortal(
    <div ref={wrapperRef} className="fixed z-2147483647 isolate">
      <div ref={outerRef} className="flex flex-col items-center gap-2">

        {/* ══ MENU CARD ══════════════════════════════════════════ */}
        {open && (
          <div className="
            w-68 overflow-hidden rounded-2xl
            bg-white dark:bg-zinc-900 sidebar-shell-theme sidebar-mobile-theme
            border border-zinc-200 dark:border-zinc-700/60
            shadow-[0_20px_60px_rgba(0,0,0,0.16),0_4px_16px_rgba(0,0,0,0.08)]
            dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]
            relative z-91
          ">

            {/* drag handle header */}
            <div
              onMouseDown={onHeaderMD}
              onTouchStart={onHeaderTS}
              className={`
                flex items-center gap-3 px-4 py-3
                bg-linear-to-r from-[#ef0001] to-[#b50000]
                select-none
                ${isDragging ? "cursor-grabbing" : "cursor-grab"}
              `}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <FiGrid className="h-3.5 w-3.5 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="sidebar-brand-kicker sidebar-brand-title text-[12px] font-bold leading-tight">QA Automação</p>
                <p className="text-[9px] text-white/60 leading-tight mt-0.5">
                  {firstOpen ? "✦ Arraste o cabeçalho para mover" : "Segure e arraste para mover"}
                </p>
              </div>
              <Grip />
            </div>

            {/* items */}
            <nav className="p-2">
              {NAV_ITEMS.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group/link flex items-center gap-3 rounded-xl px-4 py-3
                      transition-all duration-100
                      ${isActive
                        ? "sidebar-link-state-active bg-[#ef0001] text-white shadow-[0_2px_10px_rgba(239,0,1,0.3)]"
                        : "sidebar-link-state-idle text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }
                    `}
                  >
                    <span className={`
                      flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors
                      ${isActive
                        ? "sidebar-icon-state-active bg-white/20"
                        : "sidebar-icon-state-idle bg-zinc-100 dark:bg-zinc-800 group-hover/link:bg-zinc-200 dark:group-hover/link:bg-zinc-700"
                      }
                    `}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold leading-tight">{item.label}</p>
                      <p className={`sidebar-nav-caption text-[11px] leading-tight mt-0.5 ${isActive ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
                        {item.sublabel}
                      </p>
                    </div>
                    {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* ══ FAB ════════════════════════════════════════════════ */}
        <div
          className="relative flex items-center justify-center"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* pulse rings (closed only) */}
          {!open && !isDragging && (
            <>
              <span className="absolute inset-0 rounded-full animate-ping bg-[#ef0001] opacity-25 pointer-events-none" />
              <span className="absolute -inset-2 rounded-full animate-ping bg-[#ef0001] opacity-10 [animation-delay:700ms] pointer-events-none" />
            </>
          )}

          {/* hint: click */}
          <HintPill visible={!open && !isDragging && hovered && hintStep === 1}>
            👆 Clique para abrir o menu
          </HintPill>

          {/* hint: drag */}
          <HintPill visible={!open && !isDragging && hintStep === 2}>
            ✥ Arraste para reposicionar
          </HintPill>

          {/* hint: active page (on hover, after hints done) */}
          {activeItem && hintStep === 3 && (
            <HintPill visible={hovered && !open && !isDragging}>
              <activeItem.icon className="h-3 w-3 shrink-0" />
              {activeItem.label}
            </HintPill>
          )}

          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu de automação"}
            onMouseDown={onFabMD}
            onTouchStart={onFabTS}
            onClick={onFabClick}
            className={`
              relative z-92 flex h-13 w-13 items-center justify-center rounded-full
              bg-[#ef0001] text-white select-none
              shadow-[0_4px_20px_rgba(239,0,1,0.5)]
              transition-transform duration-150
              ${isDragging ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105 active:scale-95"}
            `}
          >
            {open
              ? <FiX    className="h-5 w-5 pointer-events-none" />
              : <FiGrid className="h-5 w-5 pointer-events-none" />
            }
          </button>
        </div>

      </div>
    </div>,
    portalTarget,
  );
}
