export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "global_admin";
  companyId: string;
  companyName: string;
  preferences: { theme: "light" | "dark"; language: "pt" | "en" };
};

const USERS: Record<string, UserRecord> = {
  usr_001: {
    id: "usr_001",
    name: "Usuário",
    email: "user@example.com",
    role: "user",
    companyId: "cmp_001",
    companyName: "Testing Company",
    preferences: { theme: "light", language: "pt" },
  },
  usr_admin: {
    id: "usr_admin",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    companyId: "cmp_admin",
    companyName: "Testing Company",
    preferences: { theme: "light", language: "pt" },
  },
};

export function getUserById(id: string): UserRecord | null {
  return USERS[id] ? { ...USERS[id] } : null;
}

export function updateUserEmail(id: string, email: string) {
  if (USERS[id]) {
    USERS[id].email = email;
  }
}

export function updateUserCompany(id: string, companyName: string) {
  if (USERS[id]) {
    USERS[id].companyName = companyName;
  }
}
