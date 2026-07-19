import { describe, expect, it } from "@jest/globals";

import { getVisibleGraph } from "../../../app/brain/_utils/brainGraphLayout";
import type { BrainEdge, BrainNode } from "../../../app/brain/_types/brain.types";

describe("brain graph layout filters", () => {
  it("keeps the connected profile flow for user/profile governance", () => {
    const nodes: BrainNode[] = [
      { id: "profile:technical_support", type: "profile", module: "Perfis", label: "Suporte Técnico", status: "ok", metadata: { profileType: "technical_support" } },
      { id: "company:c1", type: "company", module: "Contexto", label: "Empresa A", status: "ok", companyId: "c1", companyName: "Empresa A" },
      { id: "project:p1", type: "project", module: "Contexto", label: "Projeto A", status: "ok", companyId: "c1", companyName: "Empresa A", projectId: "p1", projectName: "Projeto A" },
      { id: "user:u1", type: "person", module: "Usuarios", label: "Ana", status: "ok", companyId: "c1", companyName: "Empresa A", metadata: { profileType: "technical_support" } },
      { id: "ticket:t1", type: "event", module: "Suporte", label: "T1", status: "ok", companyId: "c1", companyName: "Empresa A", projectId: "p1", projectName: "Projeto A", createdBy: "u1", metadata: { actorUserId: "u1" } },
    ];
    const edges: BrainEdge[] = [
      { id: "e1", source: "profile:technical_support", target: "user:u1", label: "contém usuário", type: "contains" },
      { id: "e2", source: "company:c1", target: "user:u1", label: "possui usuário", type: "contains", companyId: "c1" },
      { id: "e3", source: "company:c1", target: "project:p1", label: "possui projeto", type: "belongs_to_project", companyId: "c1", projectId: "p1" },
      { id: "e4", source: "project:p1", target: "ticket:t1", label: "organiza chamado", type: "belongs_to_project", companyId: "c1", projectId: "p1" },
      { id: "e5", source: "user:u1", target: "ticket:t1", label: "criou chamado", type: "created_by", companyId: "c1", projectId: "p1" },
    ];

    const visible = getVisibleGraph(nodes, edges, {
      moduleFilter: null,
      showOrphansOnly: false,
      showPendingOnly: false,
      profileType: "technical_support",
    });

    expect(visible.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["profile:technical_support", "user:u1", "company:c1", "project:p1", "ticket:t1"]),
    );
  });

  it("keeps connected project children even when child nodes do not store projectId directly", () => {
    const nodes: BrainNode[] = [
      { id: "project:p1", type: "project", module: "Contexto", label: "Projeto A", status: "ok", companyId: "c1", projectId: "p1", projectName: "Projeto A" },
      { id: "ticket:t1", type: "event", module: "Suporte", label: "T1", status: "ok", companyId: "c1", projectId: "p1", projectName: "Projeto A" },
      { id: "comment:c1", type: "comment", module: "Suporte", label: "Comentário", status: "ok", companyId: "c1" },
    ];
    const edges: BrainEdge[] = [
      { id: "e1", source: "project:p1", target: "ticket:t1", label: "organiza chamado", type: "belongs_to_project", companyId: "c1", projectId: "p1" },
      { id: "e2", source: "ticket:t1", target: "comment:c1", label: "tem comentário", type: "has_comment", companyId: "c1" },
    ];

    const visible = getVisibleGraph(nodes, edges, {
      moduleFilter: null,
      showOrphansOnly: false,
      showPendingOnly: false,
      projectId: "p1",
    });

    expect(visible.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["project:p1", "ticket:t1", "comment:c1"]),
    );
  });
});
