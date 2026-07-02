"use client";

import type { ComponentType } from "react";
import { FiActivity, FiCpu, FiFileText, FiGitBranch, FiKey, FiMessageCircle, FiShield, FiUsers } from "react-icons/fi";
import type { BrainEdge, BrainNode } from "../_types/brain.types";
import { getConnectedNodeIds, getModuleNames } from "../_utils/brainGraphLayout";

type BrainModuleRailProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  activeModule: string | null;
  onSelectModule: (module: string | null) => void;
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Solicitacoes: FiGitBranch,
  Defeitos: FiActivity,
  Automacao: FiCpu,
  Documentos: FiFileText,
  Usuarios: FiUsers,
  Permissoes: FiShield,
  Logs: FiKey,
  "Chat/Brain": FiMessageCircle,
};

export function BrainModuleRail({ nodes, edges, activeModule, onSelectModule }: BrainModuleRailProps) {
  const modules = getModuleNames(nodes);
  const connected = getConnectedNodeIds(edges);

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Modulos</p>
          <h2 className="mt-1 text-base font-black">Clusters</h2>
        </div>
        <button
          type="button"
          onClick={() => onSelectModule(null)}
          className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-black text-white/80 transition hover:border-cyan-200/50 hover:text-cyan-100"
        >
          Tudo
        </button>
      </div>

      <div className="space-y-2">
        {modules.map((moduleName) => {
          const Icon = ICONS[moduleName] ?? FiGitBranch;
          const moduleNodes = nodes.filter((node) => node.module === moduleName);
          const moduleNodeIds = new Set(moduleNodes.map((node) => node.id));
          const connectionCount = edges.filter((edge) => moduleNodeIds.has(edge.source) || moduleNodeIds.has(edge.target)).length;
          const orphanCount = moduleNodes.filter((node) => !connected.has(node.id)).length;
          const selected = activeModule === moduleName;

          return (
            <button
              key={moduleName}
              type="button"
              onClick={() => onSelectModule(selected ? null : moduleName)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                selected
                  ? "border-cyan-200/70 bg-cyan-200/16 shadow-[0_0_24px_rgba(103,232,249,0.2)]"
                  : "border-white/10 bg-black/12 hover:border-white/24 hover:bg-white/8"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{moduleName}</span>
                <span className="mt-1 block text-[11px] font-semibold text-white/58">
                  {moduleNodes.length} conhecimentos
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/8">
                  <span className="block h-full rounded-full bg-cyan-200/45" style={{ width: `${Math.min(100, connectionCount * 8)}%` }} />
                </span>
              </span>
              {orphanCount ? (
                <span className="rounded-full bg-rose-300/16 px-2 py-1 text-[10px] font-black text-rose-100">{orphanCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

