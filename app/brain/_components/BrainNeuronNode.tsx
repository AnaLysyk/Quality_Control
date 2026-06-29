"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FiAlertCircle, FiBox, FiCheckCircle, FiCpu, FiFileText, FiGitBranch, FiUser, FiZap } from "react-icons/fi";
import type { BrainNode } from "../_types/brain.types";
import { nodeStatusLabel, nodeTypeLabel } from "../_utils/brainGraphFormatters";

type BrainNeuronNodeData = {
  brainNode: BrainNode;
  selectedNodeId: string | null;
  related: boolean;
  orphan: boolean;
  connectedCount: number;
};

function statusClasses(node: BrainNode, selected: boolean, orphan: boolean) {
  if (selected) return "border-cyan-200 bg-cyan-200/[0.98] text-[#031020] shadow-[0_0_42px_rgba(103,232,249,0.62)]";
  if (orphan || node.status === "orphan") return "border-rose-300/75 bg-[#1b1020]/92 text-rose-50 shadow-[0_0_26px_rgba(251,113,133,0.28)]";
  if (node.status === "ok") return "border-emerald-300/70 bg-[#08201e]/92 text-emerald-50 shadow-[0_0_24px_rgba(52,211,153,0.24)]";
  if (node.status === "pending" || node.status === "warning") return "border-yellow-300/75 bg-[#221d0b]/92 text-yellow-50 shadow-[0_0_24px_rgba(250,204,21,0.24)]";
  if (node.status === "missing" || node.status === "error") return "border-red-300/75 bg-[#241015]/92 text-red-50 shadow-[0_0_24px_rgba(248,113,113,0.24)]";
  return "border-sky-300/70 bg-[#081827]/92 text-sky-50";
}

function IconForNode({ node }: { node: BrainNode }) {
  if (node.type === "company" || node.type === "project" || node.type === "module") return <FiGitBranch className="h-4 w-4" />;
  if (node.type === "person" || node.type === "requester") return <FiUser className="h-4 w-4" />;
  if (node.type === "document" || node.type === "pdf" || node.type === "email") return <FiFileText className="h-4 w-4" />;
  if (node.type === "automation" || node.type === "execution") return <FiCpu className="h-4 w-4" />;
  if (node.generatedBy === "brain") return <FiZap className="h-4 w-4" />;
  if (node.status === "ok") return <FiCheckCircle className="h-4 w-4" />;
  if (node.status === "missing" || node.status === "error" || node.status === "orphan") return <FiAlertCircle className="h-4 w-4" />;
  return <FiBox className="h-4 w-4" />;
}

function BrainNeuronNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as BrainNeuronNodeData;
  const node = nodeData.brainNode;
  const isSelected = selected || nodeData.selectedNodeId === node.id;
  const dimmed = Boolean(nodeData.selectedNodeId && !nodeData.related && !isSelected);
  const isModule = node.size === "lg" || node.type === "company" || node.type === "project" || node.type === "module";
  const isSmall = ["log", "event", "comment", "email", "pdf"].includes(node.type);
  const size = isModule ? "h-[150px] w-[220px]" : isSmall ? "h-[118px] w-[148px]" : "h-[136px] w-[184px]";
  const shortInfo = node.information || node.description || "Conhecimento aguardando novas conexoes.";

  return (
    <button
      type="button"
      className={`group relative flex ${size} flex-col items-stretch justify-between overflow-hidden rounded-[24px] border p-3 text-left backdrop-blur-md transition duration-200 hover:scale-[1.02] ${statusClasses(node, isSelected, nodeData.orphan)} ${dimmed ? "opacity-35" : "opacity-100"}`}
      title={`${node.label} - ${nodeTypeLabel(node.type)} - ${nodeStatusLabel(node.status)}`}
      aria-label={`${node.label}, ${nodeTypeLabel(node.type)}, ${nodeStatusLabel(node.status)}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-cyan-100 !bg-cyan-300/80" />
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <span className="flex items-start justify-between gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/24">
          <IconForNode node={node} />
        </span>
        <span className="rounded-full border border-white/12 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]">
          {nodeStatusLabel(node.status)}
        </span>
      </span>
      <span className="mt-2 block min-w-0">
        <span className="block line-clamp-2 text-[14px] font-black leading-tight">{node.label}</span>
        <span className="mt-1 block truncate text-[10px] font-black uppercase tracking-[0.12em] opacity-62">
          {nodeTypeLabel(node.type)} / {node.module}
        </span>
      </span>
      <span className={`mt-2 line-clamp-2 text-[11px] font-semibold leading-4 ${isSelected ? "text-[#031020]/72" : "text-white/62"}`}>
        {shortInfo}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.1em] opacity-72">
        <span>{nodeData.connectedCount} conexoes</span>
        <span>{node.generatedBy === "automation" ? "automacao" : node.generatedBy === "brain" ? "brain" : "conhecimento"}</span>
      </span>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-cyan-100 !bg-cyan-300/80" />
    </button>
  );
}

export const BrainNeuronNode = memo(BrainNeuronNodeComponent);
