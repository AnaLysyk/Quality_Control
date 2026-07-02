import { POST } from "@/api/brain/convert/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/brain/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function decodeText(payload: { contentBase64: string }) {
  return Buffer.from(payload.contentBase64, "base64").toString("utf8");
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
    expect(decodeText(payload)).toBe(Buffer.from("Quality Control", "utf8").toString("base64"));
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
    expect(decodeText(payload)).toContain('"ok": true');
  });

  it("converte json para csv", async () => {
    const response = await POST(
      makeRequest({
        filename: "execucoes.json",
        mimeType: "application/json",
        text: JSON.stringify([{ caso: "SFQ-1", status: "passed" }]),
        targetFormat: "csv",
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.filename).toBe("execucoes.csv");
    expect(decodeText(payload)).toContain("caso,status");
    expect(decodeText(payload)).toContain("SFQ-1,passed");
  });

  it("gera pdf para texto executivo", async () => {
    const response = await POST(
      makeRequest({
        filename: "resumo.txt",
        mimeType: "text/plain",
        text: "Resumo executivo da qualidade.",
        targetFormat: "pdf",
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.filename).toBe("resumo.pdf");
    expect(payload.mimeType).toBe("application/pdf");
    expect(payload.sizeBytes).toBeGreaterThan(100);
  });

  it("rejeita formato sem target", async () => {
    const response = await POST(makeRequest({ text: "x" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
  });

  it("retorna erro claro para conversao invalida", async () => {
    const response = await POST(
      makeRequest({
        filename: "texto.txt",
        mimeType: "text/plain",
        text: "nao eh json",
        targetFormat: "csv",
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.message).toBeTruthy();
  });
});

