/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatButton from "@/components/ChatButton";

const fetchApiMock = jest.fn();

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
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}));

describe("ChatButton API routing", () => {
  beforeEach(() => {
    fetchApiMock.mockReset();
    fetchApiMock.mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "ok", tool: "use_brain", actions: [], context: null }),
    });

    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    sessionStorage.clear();
  });

  it("uses /api/ai/chat when no brain context is active", async () => {
    render(<ChatButton defaultOpen />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "teste normal" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
    expect(fetchApiMock.mock.calls[0][0]).toBe("/api/ai/chat");
  });

  it("uses /api/assistant/ask after assistant:open with brain context", async () => {
    render(<ChatButton />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("assistant:open", {
          detail: {
            source: "brain",
            nodeId: "node-123",
            nodeLabel: "Nó QA",
            agentMode: "qa",
            initialMessage: "analisa esse nó",
          },
        }),
      );
    });

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "continue" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
    expect(fetchApiMock.mock.calls[0][0]).toBe("/api/assistant/ask");

    const requestBody = JSON.parse(String(fetchApiMock.mock.calls[0][1]?.body ?? "{}"));
    expect(requestBody.brainContext).toBeDefined();
    expect(requestBody.brainContext.nodeId).toBe("node-123");
    expect(requestBody.brainContext.source).toBe("brain");
  });
});
