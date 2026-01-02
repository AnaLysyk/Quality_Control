import { authorizeClientAccess, signToken } from "@/lib/jwtAuth";
import jwt from "jsonwebtoken";

jest.mock("@/data/userClientsRepository", () => ({
  getUserRoleInClient: jest.fn(),
}));

const getUserRoleInClient = jest.requireMock("@/data/userClientsRepository").getUserRoleInClient as jest.Mock;

describe("jwtAuth helpers", () => {
  const user = { id: "usr_1", email: "ana@example.com", isGlobalAdmin: false };

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  test("signToken emits a token verifiable with JWT_SECRET", () => {
    const token = signToken({ sub: user.id, email: user.email, isGlobalAdmin: user.isGlobalAdmin });
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.isGlobalAdmin).toBe(false);
  });

  test("authorizeClientAccess allows global admin sem role", async () => {
    await expect(
      authorizeClientAccess({ user: { ...user, isGlobalAdmin: true }, clientId: null })
    ).resolves.toBeUndefined();
  });

  test("authorizeClientAccess allows ADMIN role", async () => {
    getUserRoleInClient.mockResolvedValue({ role: "ADMIN" });
    await expect(
      authorizeClientAccess({ user, clientId: "cli_1", requiredRole: "ADMIN" })
    ).resolves.toBeUndefined();
  });

  test("authorizeClientAccess allows USER role when requiredRole USER", async () => {
    getUserRoleInClient.mockResolvedValue({ role: "USER" });
    await expect(
      authorizeClientAccess({ user, clientId: "cli_1", requiredRole: "USER" })
    ).resolves.toBeUndefined();
  });

  test("authorizeClientAccess denies quando sem role", async () => {
    getUserRoleInClient.mockResolvedValue(null);
    await expect(
      authorizeClientAccess({ user, clientId: "cli_1", requiredRole: "USER" })
    ).rejects.toThrow("Forbidden");
  });

  test("authorizeClientAccess denies quando requiredRole ADMIN mas role USER", async () => {
    getUserRoleInClient.mockResolvedValue({ role: "USER" });
    await expect(
      authorizeClientAccess({ user, clientId: "cli_1", requiredRole: "ADMIN" })
    ).rejects.toThrow("Forbidden");
  });

  test("authorizeClientAccess nega se clientId ausente e não global admin", async () => {
    getUserRoleInClient.mockResolvedValue(null);
    await expect(
      authorizeClientAccess({ user, clientId: null, requiredRole: "USER" })
    ).rejects.toThrow("Forbidden");
  });
});
