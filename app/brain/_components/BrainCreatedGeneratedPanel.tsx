"use client";

import { FiActivity, FiFileText, FiMail, FiZap } from "react-icons/fi";
import type { BrainEdge, BrainGraphSummary, BrainNode } from "../_types/brain.types";

type BrainCreatedGeneratedPanelProps = {
  summary: BrainGraphSummary;
  nodes: BrainNode[];
  edges: BrainEdge[];
};

export function BrainCreatedGeneratedPanel({ summary, nodes, edges }: BrainCreatedGeneratedPanelProps) {
  const today = new Date().toDateString();
  const createdToday = nodes.filter((node) => node.createdAt && new Date(node.createdAt).toDateString() === today).length;
  const emails = nodes.filter((node) => node.type === "email").length + edges.filter((edge) => edge.type === "has_email").length;
  const pdfs = nodes.filter((node) => node.type === "pdf").length + edges.filter((edge) => edge.type === "has_pdf").length;
  const defects = nodes.filter((node) => node.type === "defect").length;
  const requests = nodes.filter((node) => node.type === "access_request").length;
  const logs = nodes.filter((node) => node.type === "log").length;

  const items = [
    { label: "Criado hoje", value: summary.eventsToday ?? createdToday, icon: FiActivity },
    { label: "Gerado pelo Brain", value: summary.generatedByBrain ?? nodes.filter((node) => node.generatedBy === "brain").length, icon: FiZap },
    { label: "Gerado por automacao", value: summary.generatedByAutomation ?? nodes.filter((node) => node.generatedBy === "automation").length, icon: FiZap },
    { label: "Gerado por usuarios", value: summary.generatedByUsers ?? nodes.filter((node) => node.generatedBy === "user").length, icon: FiActivity },
    { label: "PDFs gerados", value: pdfs, icon: FiFileText },
    { label: "E-mails enviados", value: emails, icon: FiMail },
    { label: "Logs registrados", value: logs, icon: FiActivity },
    { label: "Defeitos abertos", value: defects, icon: FiActivity },
    { label: "Solicitacoes criadas", value: requests, icon: FiActivity },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Contexto</p>
        <h2 className="mt-1 text-base font-black">Criado/Gerado</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.slice(0, 8).map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-white/10 bg-black/14 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/42">{item.label}</p>
                <Icon className="h-3.5 w-3.5 text-cyan-100" />
              </div>
              <p className="mt-1 text-xl font-black">{item.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

