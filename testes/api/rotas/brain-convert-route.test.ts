import { POST } from "@/api/brain/convert/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/brain/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api/brain/convert", () => {
  it("converte texto para base64", async () => {
    const response = await POST(
      makeRequest({
        filename: "brain.txt",
        mimeType: "text/plain",
        text: "Quality Control",
        targetFormat: "base64",
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.filename).toBe("brain.base64.txt");
    expect(Buffer.from(payload.contentBase64, "base64").toString("utf8")).toBe(
      Buffer.from("Quality Control", "utf8").toString("base64"),
    );
  });

  it("formata json", async () => {
    const response = await POST(
      makeRequest({
        filename: "dados.json",
        mimeType: "application/json",
        text: "{\"ok\":true}",
        targetFormat: "json",
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(Buffer.from(payload.contentBase64, "base64").toString("utf8")).toContain('"ok": true');
  });

  it("rejeita formato sem target", async () => {
    const response = await POST(makeRequest({ text: "x" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
  });
});
