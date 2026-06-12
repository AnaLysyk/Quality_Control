import { CLARIFY_REPLY, REPEATED_REPLY_MESSAGES } from "@/lib/assistant/messages";

describe("assistant fallback messages humanization", () => {
  it("clarify reply uses humanized conversational wording", () => {
    expect(CLARIFY_REPLY.toLowerCase()).toContain("quero te ajudar");
    expect(CLARIFY_REPLY.toLowerCase()).toContain("continuarmos o fluxo");
  });

  it("repeated reply for brain keeps continuity language", () => {
    expect(REPEATED_REPLY_MESSAGES.use_brain.toLowerCase()).toContain("mesmo assunto");
  });
});
