import { extractTicketReference } from "@/lib/assistant/pure/parsing";

describe("extractTicketReference", () => {
  it("parses SP code references", () => {
    expect(extractTicketReference("verificar ticket SP-42")).toEqual({
      type: "code",
      code: "SP-000042",
      numeric: 42,
    });
  });

  it("parses UUID references", () => {
    expect(extractTicketReference("ticket 123e4567-e89b-12d3-a456-426614174000")).toEqual({
      type: "id",
      id: "123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("parses bare numeric references", () => {
    expect(extractTicketReference("chamado 9876")).toEqual({
      type: "numeric",
      numeric: 9876,
      code: "SP-009876",
    });
  });

  it("returns null when there is no ticket reference", () => {
    expect(extractTicketReference("preciso entender esse fluxo")).toBeNull();
  });
});
