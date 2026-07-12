"use client";

import { useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBriefcase,
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiRepeat,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";

type Company = { id: string; name: string; company_name?: string | null; slug: string };
type Project = { id: string; companyId: string; name: string; slug: string; status: string };
type Assignment = {
  id: string;
  role: string;
  status: string;
  company: Company;
  project: { id: string; name: string; slug: string };
};
type Person = {
  id: string;
  name: string;
  full_name?: string | null;
  email: string;
  memberships?: Array<{ companyId: string; company: Company }>;
  projectTeamAssignments?: Assignment[];
};
type Candidate = { id: string; name: string; full_name?: string | null; email: string; user?: string | null };
type ProjectAssignment = {
  id: string;
  role: string;
  status: string;
  user: Candidate;
};
type ProjectDetail = {
  project: { id: string; name: string; slug: string; companyId: string; company: Company };
  leader: ProjectAssignment | null;
  qaUsers: ProjectAssignment[];
  leaderCandidates: Candidate[];
  qaCandidates: Candidate[];
  permissions: { canEdit: boolean; canDelete: boolean };
};

type Props = {
  leader: Person;
  companies: Company[];
  projects: Project[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onMessage: (type: "success" | "error", text: string) => void;
};

const companyName = (company?: Company | null) => company?.company_name || company?.name || "Empresa";
const personName = (person?: Candidate | Person | null) => person?.full_name || person?.name || person?.email || "Pessoa";

export default function LeaderManagementPanel({ leader, companies, projects, canEdit, onChanged, onMessage }: Props) {
  const assignments = (leader.projectTeamAssignments ?? []).filter((item) => item.status === "active" && item.role === "leader_tc");
  const [addOpen, setAddOpen] = useState(false);
  const [companyId, setCompanyId] = useState(assignments[0]?.company.id || leader.memberships?.[0]?.companyId || companies[0]?.id || "");
  const [projectId, setProjectId] = useState("");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [newLeaderId, setNewLeaderId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [addQaOpen, setAddQaOpen] = useState(false);
  const [qaUserId, setQaUserId] = useState("");
  const [removeQa, setRemoveQa] = useState<ProjectAssignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [saving, setSaving] = useState(false);

  const availableProjects = useMemo(() => {
    const assignedIds = new Set(assignments.map((item) => item.project.id));
    return projects.filter((project) => project.companyId === companyId && !assignedIds.has(project.id));
  }, [assignments, companyId, projects]);

  async function callAction(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos/leadership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao atualizar vínculo");
      onMessage("success", successMessage);
      await onChanged();
      if (expandedProjectId) await loadProject(expandedProjectId, true);
    } catch (error) {
      onMessage("error", error instanceof Error ? error.message : "Falha ao atualizar vínculo");
    } finally {
      setSaving(false);
    }
  }

  async function loadProject(targetProjectId: string, force = false) {
    if (!force && expandedProjectId === targetProjectId) {
      setExpandedProjectId(null);
      setDetail(null);
      setTransferOpen(false);
      setAddQaOpen(false);
      return;
    }
    setExpandedProjectId(targetProjectId);
    setLoadingDetail(true);
    setTransferOpen(false);
    setAddQaOpen(false);
    try {
      const response = await fetch(`/api/usuarios/vinculos/leadership?projectId=${encodeURIComponent(targetProjectId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar equipe");
      setDetail(body);
      setNewLeaderId("");
      setTransferReason("");
      setQaUserId("");
    } catch (error) {
      onMessage("error", error instanceof Error ? error.message : "Falha ao carregar equipe");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function assignLeader() {
    if (!companyId || !projectId) {
      onMessage("error", "Selecione empresa e projeto para vincular a liderança.");
      return;
    }
    await callAction(
      { action: "assign_leader", userId: leader.id, companyId, projectId },
      `BRAIN confirmou: ${personName(leader)} foi vinculado ao projeto.`,
    );
    setProjectId("");
    setAddOpen(false);
  }

  async function transferLeadership() {
    if (!detail || !newLeaderId || !transferReason.trim()) {
      onMessage("error", "Selecione o novo líder e informe a justificativa.");
      return;
    }
    await callAction(
      { action: "transfer_leader", projectId: detail.project.id, newLeaderId, reason: transferReason.trim() },
      "BRAIN confirmou: liderança transferida e equipe notificada.",
    );
    setTransferOpen(false);
  }

  async function addQaUser() {
    if (!detail || !qaUserId) {
      onMessage("error", "Selecione um Usuário TC.");
      return;
    }
    await callAction(
      { action: "add_qa", projectId: detail.project.id, userId: qaUserId },
      "BRAIN confirmou: Usuário TC adicionado ao projeto.",
    );
    setQaUserId("");
    setAddQaOpen(false);
  }

  async function removeQaUser() {
    if (!detail || !removeQa || !removeReason.trim()) {
      onMessage("error", "Informe a justificativa da remoção.");
      return;
    }
    await callAction(
      { action: "remove_qa", projectId: detail.project.id, assignmentId: removeQa.id, reason: removeReason.trim() },
      "BRAIN confirmou: vínculo do Usuário TC removido.",
    );
    setRemoveQa(null);
    setRemoveReason("");
  }

  return (
    <div className="relationship-leader-panel">
      <section className="relationship-inline-section">
        <div className="relationship-section-heading">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Empresas e projetos sob liderança</p>
            <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>{assignments.length} projeto{assignments.length === 1 ? "" : "s"} em {new Set(assignments.map((item) => item.company.id)).size} empresa{new Set(assignments.map((item) => item.company.id)).size === 1 ? "" : "s"}</p>
          </div>
          {canEdit ? (
            <button type="button" className="relationship-add-toggle" onClick={() => setAddOpen((current) => !current)}>
              {addOpen ? <FiX /> : <FiPlus />}
              <span>{addOpen ? "Fechar" : "Vincular empresa/projeto"}</span>
            </button>
          ) : null}
        </div>

        {addOpen ? (
          <div className="relationship-inline-form relationship-leader-add-form mt-3">
            <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setProjectId(""); }}>
              <option value="">Selecione a empresa</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{companyName(company)}</option>)}
            </select>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Selecione o projeto sem liderança</option>
              {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <button type="button" disabled={saving || !projectId} onClick={() => void assignLeader()} className="relationship-primary-action">
              Confirmar liderança
            </button>
          </div>
        ) : null}

        {assignments.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhuma empresa ou projeto sob responsabilidade deste líder.</p>
        ) : assignments.map((assignment) => {
          const isOpen = expandedProjectId === assignment.project.id;
          return (
            <div key={assignment.id} className="relationship-project-block" data-open={isOpen}>
              <button type="button" className="relationship-project-trigger" onClick={() => void loadProject(assignment.project.id)}>
                <FiBriefcase />
                <span className="min-w-0 flex-1 text-left">
                  <strong className="block truncate">{companyName(assignment.company)}</strong>
                  <small className="block truncate">{assignment.project.name}</small>
                </span>
                <span className="relationship-project-action-label">Equipe e transferência</span>
                {isOpen ? <FiChevronUp /> : <FiChevronDown />}
              </button>

              {isOpen ? (
                <div className="relationship-project-detail">
                  {loadingDetail ? <p className="py-4 text-sm">Carregando equipe…</p> : detail ? (
                    <>
                      <div className="relationship-team-header">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Equipe do projeto</p>
                          <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>{detail.qaUsers.length} Usuário{detail.qaUsers.length === 1 ? "" : "s"} TC vinculado{detail.qaUsers.length === 1 ? "" : "s"}</p>
                        </div>
                        {detail.permissions.canEdit ? (
                          <div className="relationship-team-actions">
                            <button type="button" onClick={() => { setAddQaOpen((current) => !current); setTransferOpen(false); }}><FiUserPlus /> Adicionar usuário</button>
                            <button type="button" onClick={() => { setTransferOpen((current) => !current); setAddQaOpen(false); }}><FiRepeat /> Transferir liderança</button>
                          </div>
                        ) : null}
                      </div>

                      {addQaOpen ? (
                        <div className="relationship-operation-row">
                          <select value={qaUserId} onChange={(event) => setQaUserId(event.target.value)}>
                            <option value="">Selecione o Usuário TC</option>
                            {detail.qaCandidates
                              .filter((candidate) => !detail.qaUsers.some((assignmentItem) => assignmentItem.user.id === candidate.id))
                              .map((candidate) => <option key={candidate.id} value={candidate.id}>{personName(candidate)} · {candidate.email}</option>)}
                          </select>
                          <button type="button" disabled={saving || !qaUserId} onClick={() => void addQaUser()}>Adicionar ao projeto</button>
                        </div>
                      ) : null}

                      {transferOpen ? (
                        <div className="relationship-transfer-form">
                          <select value={newLeaderId} onChange={(event) => setNewLeaderId(event.target.value)}>
                            <option value="">Selecione o novo Líder TC</option>
                            {detail.leaderCandidates
                              .filter((candidate) => candidate.id !== detail.leader?.user.id)
                              .map((candidate) => <option key={candidate.id} value={candidate.id}>{personName(candidate)} · {candidate.email}</option>)}
                          </select>
                          <input value={transferReason} onChange={(event) => setTransferReason(event.target.value)} placeholder="Justificativa da transferência" />
                          <button type="button" disabled={saving || !newLeaderId || !transferReason.trim()} onClick={() => void transferLeadership()}>
                            Transferir projeto <FiArrowRight />
                          </button>
                        </div>
                      ) : null}

                      <div className="relationship-team-list">
                        {detail.qaUsers.length === 0 ? (
                          <p className="py-4 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum Usuário TC vinculado a este projeto.</p>
                        ) : detail.qaUsers.map((assignmentItem) => (
                          <div key={assignmentItem.id} className="relationship-team-member">
                            <FiUsers />
                            <div className="min-w-0 flex-1">
                              <strong className="block truncate">{personName(assignmentItem.user)}</strong>
                              <small className="block truncate">{assignmentItem.user.email}</small>
                            </div>
                            {detail.permissions.canDelete ? (
                              <button type="button" title="Remover vínculo" onClick={() => { setRemoveQa(assignmentItem); setRemoveReason(""); }}><FiTrash2 /></button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {removeQa ? (
        <div className="relationship-inline-dialog">
          <div>
            <p className="font-black">Remover {personName(removeQa.user)} do projeto?</p>
            <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>O vínculo será mantido no histórico e o usuário será notificado.</p>
          </div>
          <input value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Justificativa da remoção" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRemoveQa(null)}>Cancelar</button>
            <button type="button" disabled={saving || !removeReason.trim()} onClick={() => void removeQaUser()} className="relationship-danger-action">Remover vínculo</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
