import { describe, it, expect } from "@jest/globals";

// Import the pure functions from HomeContent via jest mocks

jest.mock("next/headers", () => ({ cookies: () => ({ get: () => null }) }));

// Because HomeContent is a React component with many browser APIs, we import only the pure helpers via jest.doMock

let resolveGreeting: () => string;
let resolveFirstName: (u: unknown) => string;

beforeAll(async () => {
  const mod = await import("../../app/home/HomeContent");
  resolveGreeting = mod.resolveGreeting;
  resolveFirstName = mod.resolveFirstName;
});

describe("HomeContent helpers", () => {
  it.each([
    ["2026-07-06T10:00:00-03:00", "Bom dia"],
    ["2026-07-06T15:00:00-03:00", "Boa tarde"],
    ["2026-07-06T20:00:00-03:00", "Boa noite"],
  ])("returns correct greeting for %s", (iso, expected) => {
    jest.useFakeTimers().setSystemTime(new Date(iso));
    expect(resolveGreeting()).toBe(expected);
    jest.useRealTimers();
  });

  it("extracts first name or defaults to Ana", () => {
    expect(resolveFirstName({ name: "João da Silva" })).toBe("João");
    expect(resolveFirstName({ fullName: "Maria Clara" })).toBe("Maria");
    expect(resolveFirstName({})).toBe("Ana");
  });
});