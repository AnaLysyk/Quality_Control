import { matchesAccessRequestLookup, normalizeAccessRequestLookup } from "../lib/accessRequestLookup";
import type { ParsedAccessRequest } from "../lib/accessRequestMessage";

function makeParsed(overrides?: Partial<ParsedAccessRequest>): ParsedAccessRequest {
  return {
    email: "ana.paula@testingcompany.com.br",
    name: "Ana Paula Lysyk",
    fullName: "Ana Paula Lysyk",
    username: "ana.paula.lysyk",
    phone: "",
    passwordHash: "hash",
    jobRole: "Analista",
    company: "Testing Company",
    clientId: null,
    accessType: "technical_support",
    profileType: "technical_support",
    reviewQueue: "admin_and_global",
    title: "Solicitacao",
    description: "Descricao",
    notes: "",
    companyProfile: null,
    originalRequest: {
      email: "ana.paula@testingcompany.com.br",
      name: "Ana test",
      fullName: "Ana test",
      username: "ana.paula.lysyk",
      phone: "",
      passwordHash: "hash",
      jobRole: "Analista",
      company: "Testing Company",
      clientId: null,
      accessType: "technical_support",
      profileType: "technical_support",
      title: "Solicitacao",
      description: "Descricao",
      notes: "",
      companyProfile: null,
    },
    adjustmentRound: 1,
    adjustmentRequestedFields: ["fullName", "email"],
    adjustmentHistory: [],
    lastAdjustmentAt: null,
    lastAdjustmentDiff: [],
    ...overrides,
  };
}

describe("accessRequestLookup", () => {
  it("normalizes case and accents", () => {
    expect(normalizeAccessRequestLookup(" Áná Páula ")).toBe("ana paula");
  });

  it("matches current triage values", () => {
    const parsed = makeParsed();
    expect(
      matchesAccessRequestLookup({
        lookupEmail: "ana.paula@testingcompany.com.br",
        lookupName: "Ana Paula Lysyk",
        parsed,
        storedEmail: parsed.email,
      }),
    ).toBe(true);
  });

  it("matches original requester values after triage changed the current data", () => {
    const parsed = makeParsed({
      email: "ana.paula.suporte@testingcompany.com.br",
      name: "Ana Paula Lysyk",
      fullName: "Ana Paula Lysyk",
    });

    expect(
      matchesAccessRequestLookup({
        lookupEmail: "ana.paula@testingcompany.com.br",
        lookupName: "Ana test",
        parsed,
        storedEmail: parsed.email,
      }),
    ).toBe(true);
  });
});
