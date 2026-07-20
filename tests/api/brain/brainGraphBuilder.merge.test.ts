import { mergeBrainGraphs } from "@/brain/_utils/brainGraphBuilder";
import type { BrainNode } from "@/brain/_types/brain.types";

describe("mergeBrainGraphs", () => {
  it("prefere o no mais completo e remove arestas orfas", () => {
    const basic: BrainNode = { id: "n1", type: "entity", module: "M", label: "No", status: "ok" };
    const complete: BrainNode = {
      id: "n1",
      type: "entity",
      module: "M",
      label: "No completo",
      description: "descricao",
      status: "ok",
      metadata: { source: "database" },
    };
    const other: BrainNode = { id: "n2", type: "entity", module: "M", label: "Outro", status: "ok" };

    const result = mergeBrainGraphs(
      { nodes: [basic], edges: [{ id: "orphan", source: "n1", target: "missing", label: "orfa" }] },
      { nodes: [complete, other], edges: [{ id: "valid", source: "n1", target: "n2", label: "valida" }] },
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.find((node) => node.id === "n1")?.label).toBe("No completo");
    expect(result.edges).toEqual([expect.objectContaining({ id: "valid" })]);
  });
});
