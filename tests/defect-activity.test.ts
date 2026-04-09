import {
  buildDefectComments,
  decodeDefectAssigneeNote,
  encodeDefectAssigneeNote,
  summarizeDefectActivity,
} from "@/lib/defectActivity";
import type { DefectHistoryEvent } from "@/lib/manualDefectHistoryStore";

describe("defectActivity", () => {
  it("extracts comments and latest assignee from history", () => {
    const events: DefectHistoryEvent[] = [
      {
        id: "evt-3",
        defectSlug: "qase-griaule-123",
        action: "comment_added",
        createdAt: "2026-04-08T13:00:00.000Z",
        actorId: "usr-support",
        actorName: "Suporte",
        note: "Comentario interno",
      },
      {
        id: "evt-2",
        defectSlug: "qase-griaule-123",
        action: "assignee_changed",
        createdAt: "2026-04-08T12:00:00.000Z",
        actorId: "usr-admin",
        actorName: "Admin",
        note: encodeDefectAssigneeNote({ userId: "usr-company", userName: "Empresa" }),
      },
      {
        id: "evt-1",
        defectSlug: "qase-griaule-123",
        action: "created",
        createdAt: "2026-04-08T11:00:00.000Z",
        note: "Defeito criado",
      },
    ];

    const comments = buildDefectComments(events);
    const summary = summarizeDefectActivity(events);

    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe("Comentario interno");
    expect(summary.commentsCount).toBe(1);
    expect(summary.assignedToUserId).toBe("usr-company");
    expect(summary.assignedToName).toBe("Empresa");
    expect(summary.lastCommentAt).toBe("2026-04-08T13:00:00.000Z");
  });

  it("falls back when assignee note is plain text", () => {
    expect(decodeDefectAssigneeNote("Equipe interna")).toEqual({
      userId: null,
      userName: "Equipe interna",
    });
  });
});
