"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FiAlertTriangle, FiBox, FiCheckCircle, FiCpu, FiFileText, FiGitBranch, FiLink2, FiMonitor, FiUser, FiZap } from "react-icons/fi";
import type { BrainNode } from "../_types/brain.types";

type BrainNeuronNodeData = {
  brainNode: BrainNode;
  selectedNodeId: string | null;
  related: boolean;
  orphan: boolean;
  connectedCount: number;
  themeMode?: "light" | "dark";
};

function labelize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(node: BrainNode, connectedCount: number) {
  const count = typeof node.metadata?.count === "number" ? node.metadata.count : connectedCount;
  if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "núcleo";
  if (node.metadata?.isProfileRoot) return count > 0 ? `${count} item(ns)` : "camada";
  if (node.metadata?.isCompanyHub || node.metadata?.isProjectHub || node.metadata?.isModuleHub || node.metadata?.isUserHub) return count > 0 ? `${count} item(ns)` : "sem dados";

  const map: Record<string, string> = {
    ok: "ok",
    warning: "atenção",
    missing: "não encontrado",
    pending: "pendente",
    error: "erro",
    orphan: "órfão",
  };
  return map[node.status] ?? node.status;
}

function IconForNode({ node }: { node: BrainNode }) {
  if (node.type === "company" || node.type === "project" || node.type === "module" || node.metadata?.isProfileRoot) return <FiGitBranch className="h-4 w-4" />;
  if (node.type === "screen") return <FiMonitor className="h-4 w-4" />;
  if (node.type === "integration") return <FiLink2 className="h-4 w-4" />;
  if (node.type === "person" || node.type === "requester" || node.metadata?.isUserHub) return <FiUser className="h-4 w-4" />;
  if (node.type === "document" || node.type === "pdf" || node.type === "email") return <FiFileText className="h-4 w-4" />;
  if (node.type === "automation" || node.type === "execution") return <FiCpu className="h-4 w-4" />;
  if (node.generatedBy === "brain") return <FiZap className="h-4 w-4" />;
  if (node.status === "ok") return <FiCheckCircle className="h-4 w-4" />;
  if (["missing", "error", "orphan", "warning"].includes(node.status)) return <FiAlertTriangle className="h-4 w-4" />;
  return <FiBox className="h-4 w-4" />;
}

function theme(node: BrainNode, selected: boolean, orphan: boolean, darkMode: boolean) {
  if (darkMode) {
    if (selected) return "border-cyan-100 bg-cyan-200 text-[#03111f] shadow-[0_0_90px_rgba(103,232,249,.92),0_0_180px_rgba(103,232,249,.22),inset_0_0_28px_rgba(255,255,255,.45)]";
    if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "border-yellow-300/80 bg-yellow-950/82 text-yellow-50 shadow-[0_0_58px_rgba(250,204,21,.46),inset_0_0_34px_rgba(250,204,21,.24)]";
    if (node.metadata?.isProfileRoot) return "border-sky-300/80 bg-sky-950/78 text-sky-50 shadow-[0_0_48px_rgba(56,189,248,.38),inset_0_0_34px_rgba(56,189,248,.22)]";
    if (node.type === "integration") return "border-violet-300/80 bg-violet-950/78 text-violet-50 shadow-[0_0_48px_rgba(167,139,250,.42),inset_0_0_34px_rgba(167,139,250,.22)]";
    if (node.type === "screen") return "border-sky-300/80 bg-sky-950/78 text-sky-50 shadow-[0_0_48px_rgba(56,189,248,.38),inset_0_0_34px_rgba(56,189,248,.22)]";
    if (orphan || ["missing", "error", "orphan"].includes(node.status)) return "border-rose-300/80 bg-rose-950/82 text-rose-50 shadow-[0_0_48px_rgba(251,113,133,.46),inset_0_0_34px_rgba(251,113,133,.24)]";
    if (["pending", "warning"].includes(node.status)) return "border-yellow-300/80 bg-yellow-950/82 text-yellow-50 shadow-[0_0_48px_rgba(250,204,21,.42),inset_0_0_34px_rgba(250,204,21,.24)]";
    return "border-emerald-300/75 bg-emerald-950/82 text-emerald-50 shadow-[0_0_48px_rgba(52,211,153,.38),inset_0_0_34px_rgba(52,211,153,.24)]";
  }

  if (selected) return "border-cyan-400 bg-cyan-100 text-[#03111f] shadow-[0_0_70px_rgba(34,211,238,.48),0_0_120px_rgba(34,211,238,.16),inset_0_0_28px_rgba(255,255,255,.7)]";
  if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "border-amber-300 bg-amber-300/95 text-amber-950 shadow-[0_0_40px_rgba(250,204,21,.32),inset_0_0_26px_rgba(255,255,255,.42)]";
  if (node.metadata?.isProfileRoot) return "border-sky-300 bg-sky-200/95 text-sky-950 shadow-[0_0_36px_rgba(56,189,248,.28),inset_0_0_26px_rgba(255,255,255,.4)]";
  if (node.type === "integration") return "border-violet-300 bg-violet-200/95 text-violet-950 shadow-[0_0_36px_rgba(167,139,250,.28),inset_0_0_26px_rgba(255,255,255,.4)]";
  if (node.type === "screen") return "border-sky-300 bg-sky-200/95 text-sky-950 shadow-[0_0_36px_rgba(56,189,248,.28),inset_0_0_26px_rgba(255,255,255,.4)]";
  if (orphan || ["missing", "error", "orphan"].includes(node.status)) return "border-rose-300 bg-rose-400/95 text-white shadow-[0_0_40px_rgba(251,113,133,.28),inset_0_0_26px_rgba(255,255,255,.22)]";
  if (["pending", "warning"].includes(node.status)) return "border-yellow-300 bg-yellow-300/95 text-yellow-950 shadow-[0_0_40px_rgba(250,204,21,.26),inset_0_0_26px_rgba(255,255,255,.34)]";
  return "border-emerald-300 bg-emerald-300/95 text-emerald-950 shadow-[0_0_38px_rgba(52,211,153,.24),inset_0_0_24px_rgba(255,255,255,.34)]";
}

function nodeKicker(node: BrainNode) {
  const layerLabel = typeof node.metadata?.layerLabel === "string" ? node.metadata.layerLabel : "";
  const route = typeof node.metadata?.route === "string" ? node.metadata.route : "";
  const stage = typeof node.metadata?.stage === "string" ? node.metadata.stage : "";
  const provider = typeof node.metadata?.provider === "string" ? node.metadata.provider : "";
  const accessType = typeof node.metadata?.accessType === "string" ? node.metadata.accessType : "";
  const profileType = typeof node.metadata?.profileType === "string" ? node.metadata.profileType : "";

  if (layerLabel) return layerLabel;
  if (profileType) return profileType;
  if (provider) return provider;
  if (stage) return stage;
  if (route) return route.replace(/^\/admin\//, "").replace(/^\/login\//, "");
  if (accessType) return accessType;
  return node.module;
}

function companyColor(node: BrainNode) {
  const color = node.metadata?.companyColor;
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

function BrainNeuronNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as BrainNeuronNodeData;
  const node = nodeData.brainNode;
  const darkMode = nodeData.themeMode === "dark";
  const isSelected = selected || nodeData.selectedNodeId === node.id;
  const hasFocus = Boolean(nodeData.selectedNodeId);
  const dimmed = hasFocus && !nodeData.related && !isSelected;
  const count = typeof node.metadata?.count === "number" ? node.metadata.count : nodeData.connectedCount;
  const pendingCount = typeof node.metadata?.pendingCount === "number" ? node.metadata.pendingCount : null;
  const isCore = Boolean(node.metadata?.isBrainCore || node.metadata?.isContextCore || node.metadata?.isProfileRoot || node.metadata?.isCompanyHub || node.metadata?.isModuleHub);
  const hasOperationalFlow = Boolean(node.metadata?.isOperationalFlow || node.type === "integration" || node.metadata?.isUserHub);
  const isBig = isCore || node.type === "company" || node.type === "project" || node.type === "module" || node.size === "lg";
  const isSmall = ["status", "log", "event", "email", "pdf", "comment"].includes(node.type);
  const color = companyColor(node);

  const size = isCore ? "h-[140px] w-[140px]" : isBig ? "h-[118px] w-[118px]" : isSmall ? "h-[82px] w-[82px]" : "h-[96px] w-[96px]";
  const chromeClass = darkMode ? "bg-black/42 text-white" : "bg-white/45 text-current";
  const metaChipClass = darkMode ? "bg-black/42" : "bg-white/50";
  const flowChipClass = darkMode ? "border-white/18 bg-black/48 text-white/82" : "border-[#011848]/10 bg-white/70 text-[#011848]/70";
  const ringClass = darkMode ? "border-white/18" : "border-[#011848]/10";
  const glowClass = darkMode ? "bg-cyan-300/24" : "bg-cyan-300/18";
  const glareClass = darkMode ? "bg-white/24" : "bg-white/55";

  return (
    <div
      data-brain-node-id={node.id}
      data-brain-node-status={node.status}
      data-brain-node-type={node.type}
      title={`${node.label} · ${nodeKicker(node)} · ${statusLabel(node, nodeData.connectedCount)}`}
      style={color && !isSelected ? {
        borderColor: color,
        boxShadow: `0 0 52px ${color}66, inset 0 0 34px ${color}2e`,
      } : undefined}
      className={`brain-orb-node relative flex ${size} cursor-grab select-none flex-col items-center justify-center rounded-full border text-center backdrop-blur-md transition duration-300 active:cursor-grabbing ${theme(node, isSelected, nodeData.orphan, darkMode)} ${dimmed ? "scale-75 opacity-35 blur-[1px]" : "opacity-100"} ${isSelected ? "z-30 scale-110" : "z-10"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-cyan-100 !bg-cyan-300" />

      <span className={`pointer-events-none absolute inset-[-18px] rounded-full border ${ringClass}`} />
      <span className={`pointer-events-none absolute inset-[-34px] rounded-full ${glowClass} blur-3xl`} />
      <span className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full ${glareClass} blur-2xl`} />
      {hasOperationalFlow ? (
        <span className={`pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] ${flowChipClass}`}>
          fluxo
        </span>
      ) : null}

      <span className={`relative z-10 mb-1 flex h-8 w-8 items-center justify-center rounded-full ${chromeClass}`}>
        <IconForNode node={node} />
      </span>

      <span className="relative z-10 line-clamp-2 max-w-[78%] text-[12px] font-black leading-tight">
        {node.label}
      </span>

      <span className="relative z-10 mt-1 max-w-[78%] truncate text-[8px] font-black uppercase tracking-[0.15em] opacity-70">
        {labelize(nodeKicker(node))}
      </span>

      <span className={`relative z-10 mt-1 rounded-full ${metaChipClass} px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] opacity-90`}>
        {statusLabel(node, nodeData.connectedCount)}
      </span>

      {isBig ? (
        <span className="relative z-10 mt-1 max-w-[80%] truncate text-[9px] font-black uppercase opacity-80">
          {count} nós{pendingCount ? ` · ${pendingCount} pend.` : ""}
        </span>
      ) : null}

      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-cyan-100 !bg-cyan-300" />
    </div>
  );
}

export const BrainNeuronNode = memo(BrainNeuronNodeComponent);
