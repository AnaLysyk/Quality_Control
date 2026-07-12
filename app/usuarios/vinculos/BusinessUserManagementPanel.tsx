"use client";

import { useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiCheck, FiHome, FiPlus, FiTrash2, FiX } from "react-icons/fi";

type Company = { id: string; name: string; company_name?: string | null; slug: string };
type Project = { id: string; companyId: string; name: string; slug: string; status: string };
type Person = { id: string; name: string; full_name?: string | null; email: string };
type Detail = {
  user: Person & { active: boolean; status: string };
  company: Company;
  projects: Project[];
  selectedProjectIds: string[];
  permissions: { canManage: boolean; canDeactivate: boolean };
};

type Props = {
  person: Person;
  onChanged: () => Promise<void>;
  onMessage: (type: "success" | "error", text: string) => void;
};

const companyName = (company?: Company | null) => company?.company_name || company?.name || "Empresa";

export default function BusinessUserManagementPanel({ person, onChanged, onMessage }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingProjects, setEditingProjects] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedProjects = useMemo(
    () => detail?.projects.filter((project) => selectedIds.includes(project.id)) ?? [],
    [detail, selectedIds],
  );

  useEffect(() => {
    void load();
  }, [person.id]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/usuarios/vinculos/business-users?userId=${encodeURIComponent(person.id)}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar usuário empresarial");
      setDetail(body);
      setSelectedIds(body.selectedProjectIds ?? []);
    } catch (error) {
      onMessage("error", error instanceof Error ? error.message : "Falha ao carregar usuário empresarial");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleProject(projectId: string) {
    setSelectedIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  async function saveProjects() {
    if (!selectedIds.length) {
      onMessage("error", "Selecione pelo menos um projeto.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos/business-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_projects", userId: person.id, projectIds: selectedIds }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao atualizar projetos");
      onMessage("success", "BRAIN confirmou: projetos do usuário empresarial atualizados.");
      setEditingProjects(false);
      await load();
      await onChanged();
    } catch (error) {
      onMessage("error", error instanceof Error ? error.message : "Falha ao atualizar projetos");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!reason.trim()) {
      onMessage("error", "Informe a justificativa da remoção.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos/business-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate", userId: person.id, reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao remover usuário empresarial");
      onMessage("success", "BRAIN confirmou: acesso empresarial removido e histórico preservado.");
      setRemoveOpen(false);
      setReason("");
      await onChanged();
    } catch (error) {
      onMessage("error", error instanceof Error ? error.message : "Falha ao remover usuário empresarial");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-5 text-sm" style={{ color: "var(--rel-muted)" }}>Carregando empresa e projetos…</p>;
  }

  if (!detail) return null;

  return (
    <div className="relationship-business-panel">
      <section className="relationship-inline-section">
        <div className="relationship-section-heading">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Empresa de origem</p>
            <div className="relationship-link-line mt-2">
              <FiHome />
              <div className="flex-1">
                <p className="font-black">{companyName(detail.company)}</p>
                <p className="text-xs" style={{ color: "var(--rel-muted)" }}>Usuário empresarial com escopo exclusivo desta empresa</p>
              </div>
            </div>
          </div>
          {detail.permissions.canDeactivate ? (
            <button type="button" className="relationship-danger-link" onClick={() => setRemoveOpen(true)}>
              <FiTrash2 /> Remover acesso
            </button>
          ) : null}
        </div>
      </section>

      <section className="relationship-inline-section">
        <div className="relationship-section-heading">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Projetos autorizados</p>
            <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>
              {selectedProjects.length} projeto{selectedProjects.length === 1 ? "" : "s"} selecionado{selectedProjects.length === 1 ? "" : "s"}
            </p>
          </div>
          {detail.permissions.canManage ? (
            <button type="button" className="relationship-add-toggle" onClick={() => setEditingProjects((current) => !current)}>
              {editingProjects ? <FiX /> : <FiPlus />}
              <span>{editingProjects ? "Fechar" : "Gerenciar projetos"}</span>
            </button>
          ) : null}
        </div>

        {!editingProjects ? (
          selectedProjects.length ? selectedProjects.map((project) => (
            <div key={project.id} className="relationship-link-line">
              <FiBriefcase />
              <div className="flex-1">
                <p className="font-bold">{project.name}</p>
                <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{companyName(detail.company)}</p>
              </div>
            </div>
          )) : <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum projeto autorizado.</p>
        ) : (
          <div className="relationship-project-picker mt-3">
            {detail.projects.map((project) => {
              const checked = selectedIds.includes(project.id);
              return (
                <button key={project.id} type="button" data-selected={checked} onClick={() => toggleProject(project.id)}>
                  <span className="relationship-project-check">{checked ? <FiCheck /> : null}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block truncate">{project.name}</strong>
                    <small className="block truncate">{companyName(detail.company)}</small>
                  </span>
                </button>
              );
            })}
            <button type="button" className="relationship-primary-action" disabled={saving || !selectedIds.length} onClick={() => void saveProjects()}>
              Salvar projetos
            </button>
          </div>
        )}
      </section>

      {removeOpen ? (
        <div className="relationship-inline-danger-zone">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-black">Remover acesso empresarial</p>
              <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>A conta será desativada e o histórico será preservado.</p>
            </div>
            <button type="button" onClick={() => setRemoveOpen(false)}><FiX /></button>
          </div>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Justificativa obrigatória" />
          <button type="button" className="relationship-danger-action" disabled={saving || !reason.trim()} onClick={() => void deactivate()}>
            Confirmar remoção do acesso
          </button>
        </div>
      ) : null}
    </div>
  );
}
