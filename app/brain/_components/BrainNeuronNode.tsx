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
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(node: BrainNode, connectedCount: number) {
  const count = typeof node.metadata?.count === "number" ? node.metadata.count : connectedCount;
  if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "núcleo";
  if (node.metadata?.isProfileRoot) return count > 0 ? `${count} itens` : "perfil";
  if (node.metadata?.isCompanyHub || node.metadata?.isProjectHub || node.metadata?.isModuleHub || node.metadata?.isUserHub || node.metadata?.isUserTypeHub) return count > 0 ? `${count} itens` : "sem dados";

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
  if (node.type === "company" || node.type === "project" || node.type === "module" || node.metadata?.isProfileRoot || node.metadata?.isUserTypeHub) return <FiGitBranch className="h-4 w-4" />;
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
    if (selected) return "border-cyan-200/90 bg-slate-900/96 text-slate-50 shadow-[0_0_70px_rgba(103,232,249,.44),inset_0_0_24px_rgba(103,232,249,.12)]";
    if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "border-cyan-200/80 bg-[#07152b]/96 text-slate-50 shadow-[0_0_46px_rgba(34,211,238,.28),inset_0_0_22px_rgba(34,211,238,.10)]";
    if (node.metadata?.isProfileRoot || node.metadata?.isUserTypeHub) return "border-sky-300/80 bg-sky-950/94 text-sky-50 shadow-[0_0_38px_rgba(56,189,248,.28),inset_0_0_18px_rgba(56,189,248,.12)]";
    if (node.type === "integration") return "border-violet-300/80 bg-violet-950/94 text-violet-50 shadow-[0_0_36px_rgba(167,139,250,.28),inset_0_0_18px_rgba(167,139,250,.12)]";
    if (node.type === "screen") return "border-sky-300/80 bg-sky-950/94 text-sky-50 shadow-[0_0_36px_rgba(56,189,248,.26),inset_0_0_18px_rgba(56,189,248,.12)]";
    if (orphan || ["missing", "error", "orphan"].includes(node.status)) return "border-rose-300/80 bg-rose-950/94 text-rose-50 shadow-[0_0_36px_rgba(251,113,133,.30),inset_0_0_18px_rgba(251,113,133,.12)]";
    if (["pending", "warning"].includes(node.status)) return "border-yellow-300/80 bg-yellow-950/94 text-yellow-50 shadow-[0_0_36px_rgba(250,204,21,.28),inset_0_0_18px_rgba(250,204,21,.12)]";
    return "border-emerald-300/75 bg-emerald-950/94 text-emerald-50 shadow-[0_0_34px_rgba(52,211,153,.24),inset_0_0_18px_rgba(52,211,153,.10)]";
  }

  if (selected) return "border-cyan-400 bg-white text-[#011848] shadow-[0_0_42px_rgba(34,211,238,.34),inset_0_0_20px_rgba(34,211,238,.08)]";
  if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "border-[#011848]/30 bg-white text-[#011848] shadow-[0_0_28px_rgba(34,211,238,.18),inset_0_0_18px_rgba(34,211,238,.08)]";
  if (node.metadata?.isProfileRoot || node.metadata?.isUserTypeHub) return "border-sky-300 bg-white text-sky-950 shadow-[0_0_26px_rgba(56,189,248,.18),inset_0_0_18px_rgba(56,189,248,.08)]";
  if (node.type === "integration") return "border-violet-300 bg-white text-violet-950 shadow-[0_0_24px_rgba(167,139,250,.18),inset_0_0_16px_rgba(167,139,250,.08)]";
  if (node.type === "screen") return "border-sky-300 bg-white text-sky-950 shadow-[0_0_24px_rgba(56,189,248,.18),inset_0_0_16px_rgba(56,189,248,.08)]";
  if (orphan || ["missing", "error", "orphan"].includes(node.status)) return "border-rose-300 bg-white text-rose-950 shadow-[0_0_24px_rgba(251,113,133,.18),inset_0_0_16px_rgba(251,113,133,.08)]";
  if (["pending", "warning"].includes(node.status)) return "border-yellow-300 bg-white text-yellow-950 shadow-[0_0_24px_rgba(250,204,21,.18),inset_0_0_16px_rgba(250,204,21,.08)]";
  return "border-emerald-300 bg-white text-emerald-950 shadow-[0_0_22px_rgba(52,211,153,.16),inset_0_0_16px_rgba(52,211,153,.08)]";
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

function nodeInstruction(node: BrainNode) {
  const scopeType = typeof node.metadata?.scopeType === "string" ? node.metadata.scopeType : "";
  const userType = typeof node.metadata?.userType === "string" ? node.metadata.userType : "";

  if (node.metadata?.isBrainCore || node.metadata?.isContextCore) return "Gestão de permissões";
  if (node.metadata?.isProfileRoot) return "perfil libera telas";
  if (scopeType === "companies") return "empresas do perfil";
  if (scopeType === "users") return "perfis e usuários";
  if (scopeType === "requests") return "solicitações";
  if (scopeType === "agenda") return "agenda";
  if (node.metadata?.isUserTypeHub) return "tipo de usuário";
  if (node.metadata?.isUserHub) return userType ? `${userType}` : "usuário";
  if (node.metadata?.isCompanyHub) return "empresa";
  if (node.metadata?.isProjectHub) return "projeto";
  if (node.metadata?.isModuleHub) return "módulo permitido";
  if (node.metadata?.isDetailNode) return "item criado";
  return labelize(node.type || node.module);
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
  const isCore = Boolean(node.metadata?.isBrainCore || node.metadata?.isContextCore || node.metadata?.isProfileRoot || node.metadata?.isCompanyHub || node.metadata?.isModuleHub || node.metadata?.isUserTypeHub);
  const hasOperationalFlow = Boolean(node.metadata?.isOperationalFlow || node.type === "integration" || node.metadata?.isUserHub || node.metadata?.isDetailNode);
  const isBig = isCore || node.type === "company" || node.type === "project" || node.type === "module" || node.size === "lg";
  const isSmall = ["status", "log", "event", "email", "pdf", "comment"].includes(node.type);
  const color = companyColor(node);

  const size = isCore ? "h-[136px] w-[190px]" : isBig ? "h-[124px] w-[176px]" : isSmall ? "h-[96px] w-[150px]" : "h-[110px] w-[164px]";
  const chromeClass = darkMode ? "bg-black/42 text-white" : "bg-[#011848]/8 text-[#011848]";
  const metaChipClass = darkMode ? "bg-black/46 text-white" : "bg-[#011848]/8 text-[#011848]";
  const flowChipClass = darkMode ? "border-white/18 bg-black/54 text-white/86" : "border-[#011848]/10 bg-white/90 text-[#011848]/76";
  const ringClass = darkMode ? "border-white/12" : "border-[#011848]/8";
  const glowClass = darkMode ? "bg-cyan-300/18" : "bg-cyan-200/14";
  const glareClass = darkMode ? "bg-white/18" : "bg-white/58";

  return (
    <div
      data-brain-node-id={node.id}
      data-brain-node-status={node.status}
      data-brain-node-type={node.type}
      title={`${node.label} · ${nodeKicker(node)} · ${nodeInstruction(node)} · ${statusLabel(node, nodeData.connectedCount)}`}
      style={color && !isSelected ? { borderColor: color, boxShadow: darkMode ? `0 0 44px ${color}55, inset 0 0 22px ${color}24` : `0 0 28px ${color}28, inset 0 0 16px ${color}14` } : undefined}
      className={`brain-orb-node relative flex ${size} cursor-grab select-none flex-col items-center justify-center rounded-[32px] border px-3 text-center backdrop-blur-md transition duration-300 active:cursor-grabbing ${theme(node, isSelected, nodeData.orphan, darkMode)} ${dimmed ? "scale-75 opacity-35 blur-[1px]" : "opacity-100"} ${isSelected ? "z-30 scale-105" : "z-10"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-cyan-100 !bg-cyan-300" />
      <span className={`pointer-events-none absolute inset-[-14px] rounded-[40px] border ${ringClass}`} />
      <span className={`pointer-events-none absolute inset-[-28px] rounded-[48px] ${glowClass} blur-3xl`} />
      <span className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full ${glareClass} blur-2xl`} />
      {hasOperationalFlow ? <span className={`pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${flowChipClass}`}>fluxo</span> : null}
      <span className={`relative z-10 mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chromeClass}`}><IconForNode node={node} /></span>
      <span className="relative z-10 w-full break-words text-[13px] font-black leading-[1.08] tracking-[-0.02em]">{node.label}</span>
      <span className="relative z-10 mt-1 w-full truncate text-[8px] font-black uppercase tracking-[0.12em] opacity-75">{labelize(nodeKicker(node))}</span>
      <span className={`relative z-10 mt-1 max-w-full rounded-full ${metaChipClass} px-2.5 py-1 text-[8.5px] font-black uppercase tracking-[0.08em] opacity-95`}>{statusLabel(node, nodeData.connectedCount)}</span>
      <span className="relative z-10 mt-1 w-full truncate text-[9px] font-black uppercase opacity-82">{nodeInstruction(node)}</span>
      {isBig ? <span className="relative z-10 mt-1 max-w-full truncate text-[9px] font-black uppercase opacity-80">{count} nós{pendingCount ? ` · ${pendingCount} pend.` : ""}</span> : null}
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-cyan-100 !bg-cyan-300" />
    </div>
  );
}

export const BrainNeuronNode = memo(BrainNeuronNodeComponent);
