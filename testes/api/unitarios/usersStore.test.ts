import { getUserById, updateUserEmail, updateUserCompany } from "../../../data/usersStore";

describe("usersStore", () => {
  it("should get user by id", () => {
    const user = getUserById("usr_001");
    expect(user).not.toBeNull();
    expect(user?.id).toBe("usr_001");
    expect(user?.name).toBe("Usuário");
  });

  it("should return null for non-existent user", () => {
    const user = getUserById("invalid_id");
    expect(user).toBeNull();
  });

  it("should update user email", () => {
    updateUserEmail("usr_001", "newemail@example.com");
    const user = getUserById("usr_001");
    expect(user?.email).toBe("newemail@example.com");
    
    // Restaurar estado
    updateUserEmail("usr_001", "user@example.com");
  });

  it("should update user company", () => {
    updateUserCompany("usr_001", "New Company Name");
    const user = getUserById("usr_001");
    expect(user?.companyName).toBe("New Company Name");
    
    // Restaurar estado
    updateUserCompany("usr_001", "Testing Company");
  });
});
