import { guardOutboundUrl } from "@/backend/brain/ssrfGuard";

describe("guardOutboundUrl - protecao SSRF para fontes externas do Brain", () => {
  it("bloqueia protocolos que nao sejam http/https", async () => {
    const result = await guardOutboundUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
  });

  it("bloqueia URL invalida", async () => {
    const result = await guardOutboundUrl("nao e uma url");
    expect(result.ok).toBe(false);
  });

  it("bloqueia localhost e loopback", async () => {
    expect((await guardOutboundUrl("http://localhost/health")).ok).toBe(false);
    expect((await guardOutboundUrl("http://127.0.0.1:5432/")).ok).toBe(false);
    expect((await guardOutboundUrl("http://[::1]/")).ok).toBe(false);
  });

  it("bloqueia redes privadas RFC1918", async () => {
    expect((await guardOutboundUrl("http://10.0.0.5/")).ok).toBe(false);
    expect((await guardOutboundUrl("http://172.16.0.5/")).ok).toBe(false);
    expect((await guardOutboundUrl("http://192.168.1.5/")).ok).toBe(false);
  });

  it("bloqueia metadata de nuvem (link-local 169.254.x.x)", async () => {
    const result = await guardOutboundUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
  });

  it("permite host publico com IP literal nao privado", async () => {
    const result = await guardOutboundUrl("https://8.8.8.8/");
    expect(result.ok).toBe(true);
  });
});
