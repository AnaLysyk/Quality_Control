import "server-only";

import { upsertNode, connectNodes, addMemory } from "@/lib/brain";
import { prisma } from "@/lib/prismaClient";

/**
 * Auto-sync helpers — chamados após operações de negócio para
 * manter o Brain atualizado automaticamente.
 *
 * Todas as funções são fire-and-forget (não lançam erros ao caller).
 */

export async function brainOnTicketCreated(ticket: {
  id: string;
  title: string;
  description?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  createdBy?: string | null;
  status?: string;
  priority?: string;
}) {
  try {
    const node = await upsertNode({
      type: "Ticket",
      label: ticket.title,
      refType: "Ticket",
      refId: ticket.id,
      description: ticket.description ?? undefined,
      metadata: {
        companyId: ticket.companyId,
        status: ticket.status,
        priority: ticket.priority,
      },
    });

    // Conectar ao nó da empresa
    const companyRef = ticket.companyId ?? ticket.companySlug;
    if (companyRef) {
      const companyNode = await prisma.brainNode.findFirst({
        where: {
          refType: "Company",
          OR: [{ refId: companyRef }],
        },
      });
      if (companyNode) {
        await connectNodes(node.id, companyNode.id, "BELONGS_TO");
      }
    }

    // Conectar ao criador
    if (ticket.createdBy) {
      const userNode = await prisma.brainNode.findFirst({
        where: { refType: "User", refId: ticket.createdBy },
      });
      if (userNode) {
        await connectNodes(node.id, userNode.id, "CREATED_BY");
      }
    }
  } catch (error) {
    console.error("[brainSync] Erro ao sincronizar ticket:", error);
  }
}

export async function brainOnTicketUpdated(ticket: {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  assignedToUserId?: string | null;
}) {
  try {
    await upsertNode({
      type: "Ticket",
      label: ticket.title,
      refType: "Ticket",
      refId: ticket.id,
      metadata: {
        status: ticket.status,
        priority: ticket.priority,
      },
    });

    // Conectar ao assignee se mudou
    if (ticket.assignedToUserId) {
      const ticketNode = await prisma.brainNode.findFirst({
        where: { refType: "Ticket", refId: ticket.id },
      });
      const userNode = await prisma.brainNode.findFirst({
        where: { refType: "User", refId: ticket.assignedToUserId },
      });
      if (ticketNode && userNode) {
        await connectNodes(ticketNode.id, userNode.id, "ASSIGNED_TO");
      }
    }
  } catch (error) {
    console.error("[brainSync] Erro ao atualizar ticket:", error);
  }
}

export async function brainOnDefectCreated(defect: {
  id: string;
  title: string;
  description?: string | null;
  companyId?: string | null;
  severity?: string;
  status?: string;
}) {
  try {
    const node = await upsertNode({
      type: "Defect",
      label: defect.title,
      refType: "Defect",
      refId: defect.id,
      description: defect.description ?? undefined,
      metadata: {
        companyId: defect.companyId,
        severity: defect.severity,
        status: defect.status,
      },
    });

    if (defect.companyId) {
      const companyNode = await prisma.brainNode.findFirst({
        where: { refType: "Company", refId: defect.companyId },
      });
      if (companyNode) {
        await connectNodes(node.id, companyNode.id, "BELONGS_TO");
      }
    }

    // Adicionar memória se defeito crítico
    if (defect.severity === "CRITICAL" || defect.severity === "critical") {
      await addMemory({
        title: `Defeito Crítico: ${defect.title}`,
        summary: `Defeito crítico encontrado: ${defect.description?.slice(0, 200) ?? defect.title}. Requer atenção imediata.`,
        memoryType: "EXCEPTION",
        importance: 5,
        relatedNodeIds: [node.id],
        sourceType: "DEFECT",
        sourceId: defect.id,
      });
    }
  } catch (error) {
    console.error("[brainSync] Erro ao sincronizar defeito:", error);
  }
}

export async function brainOnUserCreated(user: {
  id: string;
  name: string;
  email?: string;
  role?: string;
}) {
  try {
    await upsertNode({
      type: "User",
      label: user.name,
      refType: "User",
      refId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[brainSync] Erro ao sincronizar usuario:", error);
  }
}

export async function brainOnCompanyCreated(company: {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
}) {
  try {
    await upsertNode({
      type: "Company",
      label: company.name,
      refType: "Company",
      refId: company.id,
      description: company.description ?? undefined,
      metadata: { status: company.status },
    });
  } catch (error) {
    console.error("[brainSync] Erro ao sincronizar empresa:", error);
  }
}

export async function brainOnReleaseCreated(release: {
  id: string;
  title: string;
  description?: string | null;
  companyId?: string | null;
  status?: string;
}) {
  try {
    const node = await upsertNode({
      type: "Release",
      label: release.title,
      refType: "Release",
      refId: release.id,
      description: release.description ?? undefined,
      metadata: {
        companyId: release.companyId,
        status: release.status,
      },
    });

    if (release.companyId) {
      const companyNode = await prisma.brainNode.findFirst({
        where: { refType: "Company", refId: release.companyId },
      });
      if (companyNode) {
        await connectNodes(node.id, companyNode.id, "BELONGS_TO");
      }
    }
  } catch (error) {
    console.error("[brainSync] Erro ao sincronizar release:", error);
  }
}
