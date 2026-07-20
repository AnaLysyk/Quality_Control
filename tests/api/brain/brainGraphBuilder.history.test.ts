import { buildAccessRequestsBrainGraph } from "@/brain/_utils/brainGraphBuilder";

describe("brain graph removal history", () => {
  it("adiciona solicitacao removida e decisao de remocao", () => {
    const result = buildAccessRequestsBrainGraph({
      requests: [],
      removalHistory: [
        {
          id: "history-1",
          requestId: "removed-1",
          requesterEmail: "removed@teste.local",
          requesterName: "Pessoa Removida",
          removedAt: "2026-07-18T10:00:00.000Z",
          removedByEmail: "admin@teste.local",
          source: "manual",
        },
      ],
    });

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "access_request:removed-1", status: "warning" }),
        expect.objectContaining({ id: "decision:removed:removed-1", label: "Remocao registrada" }),
      ]),
    );
    expect(result.edges).toContainEqual(expect.objectContaining({ id: "removed-removed-1-decision" }));
  });
});
