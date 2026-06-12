jest.mock("@/lib/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/automations/executionAuditStore", () => ({
  saveAutomationExecutionAudit: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/api/automations/qc/page-smoke/route";
import { saveAutomationExecutionAudit } from "@/lib/automations/executionAuditStore";
import { authenticateRequest } from "@/lib/jwtAuth";

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_PORT = process.env.PORT;

function makeRequest(body: Record<string, unknown>, headers: HeadersInit = {}) {
  return new Request("https://quality-control-qwqs.onrender.com/api/automations/qc/page-smoke", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "access_token=token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("api/automations/qc/page-smoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PORT = ORIGINAL_PORT;
    (authenticateRequest as jest.Mock).mockResolvedValue({
      id: "usr_dev",
      email: "support@test.local",
      permissionRole: "technical_support",
      role: "technical_support",
      companyRole: "technical_support",
      isGlobalAdmin: false,
      companySlugs: [],
    });
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.PORT = ORIGINAL_PORT;
  });

  it("uses the local Render port for internal page fetches", async () => {
    process.env.PORT = "10000";
    const fetchMock = jest.fn().mockResolvedValue(
      new Response("<html><head><title>Quality Control</title></head><body>Buscar empresa por nome ou slug</body></html>", {
        status: 200,
        statusText: "OK",
      }),
    );
    global.fetch = fetchMock;

    const response = await POST(
      makeRequest({
        companySlug: "testing-company",
        expectedText: "Buscar empresa por nome ou slug",
        targetPath: "/admin/dashboard",
        titleHint: "Quality Control",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:10000/admin/dashboard"),
      expect.objectContaining({
        method: "GET",
        redirect: "follow",
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("host")).toBe("quality-control-qwqs.onrender.com");
    expect(headers.get("x-forwarded-proto")).toBe("https");
    expect(headers.get("cookie")).toBe("access_token=token");
    expect(saveAutomationExecutionAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        companySlug: "testing-company",
        metadata: expect.objectContaining({
          fetchUrl: "http://127.0.0.1:10000/admin/dashboard",
          targetUrl: "https://quality-control-qwqs.onrender.com/admin/dashboard",
        }),
      }),
    );
  });

  it("rejects protocol-relative paths instead of fetching external hosts", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const response = await POST(
      makeRequest({
        companySlug: "testing-company",
        targetPath: "//example.com/admin/dashboard",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("interna");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
