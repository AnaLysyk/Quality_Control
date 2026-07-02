/** @jest-environment jsdom */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import ChatButton from "../../../app/components/ChatButton";

const fetchApiMock = jest.fn<
  (input: string, init?: RequestInit) => Promise<Response>
>();

jest.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));

jest.mock("@/hooks/usePermissionAccess", () => ({
  usePermissionAccess: () => ({
    user: {
      id: "user-1",
      name: "Ana",
      avatarUrl: null,
      permissionRole: "leader_tc",
      role: "leader_tc",
      companyRole: null,
      userOrigin: "testing_company",
      isGlobalAdmin: true,
    },
    can: () => true,
    normalizedUser: {
      companySlugs: ["acme"],
      primaryCompanySlug: "acme",
      defaultCompanySlug: "acme",
    },
  }),
}));

jest.mock("@/lib/api", () => ({
  fetchApi: (input: string, init?: RequestInit) => fetchApiMock(input, init),
}));

describe("ChatButton API routing", () => {
  beforeEach(() => {
    fetchApiMock.mockReset();
    fetchApiMock.mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "ok", tool: "use_brain", actions: [], context: null }),
    } as Response);

    const fetchMock = jest.fn<typeof fetch>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    globalThis.fetch = fetchMock;

    localStorage.clear();
  });

  it("uses /api/assistente/ask when no brain context is active", async () => {
    render(<ChatButton defaultOpen />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "teste normal" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
    expect(fetchApiMock.mock.calls[0][0]).toBe("/api/assistente/ask");
  });

  it("uses /api/assistente/ask after assistant:open with brain context", async () => {
    render(<ChatButton />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("assistant:open", {
          detail: {
            source: "brain",
            nodeId: "node-123",
            nodeLabel: "NÃ³ QA",
            agentMode: "qa",
            initialMessage: "analisa esse nÃ³",
          },
        }),
      );
    });

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "continue" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
    expect(fetchApiMock.mock.calls[0][0]).toBe("/api/assistente/ask");

    const requestBody = JSON.parse(String(fetchApiMock.mock.calls[0][1]?.body ?? "{}"));
    expect(requestBody.brainContext).toBeDefined();
    expect(requestBody.brainContext.nodeId).toBe("node-123");
    expect(requestBody.brainContext.source).toBe("brain");
  });
});

