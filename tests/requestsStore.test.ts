import { addRequest, updateRequestStatus, listUserRequests } from "@/data/requestsStore";
import type { SessionUser } from "@/lib/session";

const user: SessionUser = {
  id: "usr_test",
  name: "Tester",
  email: "tester@example.com",
  role: "user",
  companyId: "cmp1",
  companyName: "Client",
  preferences: { theme: "light", language: "pt" },
};

describe("requestsStore", () => {
  it("impede duplicata pendente para mesmo user/tipo", () => {
    addRequest(user, "EMAIL_CHANGE", { newEmail: "novo@example.com" });
    expect(() => addRequest(user, "EMAIL_CHANGE", { newEmail: "outro@example.com" })).toThrow();
  });

  it("atualiza status para APPROVED", () => {
    const rec = addRequest(user, "COMPANY_CHANGE", { newCompanyName: "Nova" });
    const updated = updateRequestStatus(rec.id, "APPROVED", user, "ok");
    expect(updated?.status).toBe("APPROVED");
  });

  it("não atualiza se id inexistente retorna null", () => {
    const updated = updateRequestStatus("naoexiste", "APPROVED", user, "");
    expect(updated).toBeNull();
  });

  it("mantém status se já não for PENDING", () => {
    const otherUser = { ...user, id: "usr_test_2" };
    const rec = addRequest(otherUser, "EMAIL_CHANGE", { newEmail: "novo2@example.com" });
    const first = updateRequestStatus(rec.id, "APPROVED", user, "");
    const second = updateRequestStatus(rec.id, "REJECTED", user, "");
    expect(first?.status).toBe("APPROVED");
    expect(second?.status).toBe("APPROVED");
  });

  it("listUserRequests retorna somente do usuário", () => {
    const items = listUserRequests(user.id);
    expect(items.every((r) => r.userId === user.id)).toBe(true);
  });
});
