import fs from "fs/promises";
import path from "path";


function getCompanyPaths(companyId: string) {
  const base = path.join(process.cwd(), "data", "companies", companyId);
  return {
    users: path.join(base, "users.json"),
    history: path.join(base, "users-history.json"),
  };
}



// Lock simples por companyId
const locks: Record<string, boolean> = {};
// Cache simples por empresa
const cache: Map<string, any[]> = new Map();
async function acquireLock(companyId: string) {
  while (locks[companyId]) {
    await new Promise((r) => setTimeout(r, 10));
  }
  locks[companyId] = true;
}
function releaseLock(companyId: string) {
  locks[companyId] = false;
}



export async function readUsers(companyId: string) {
  if (cache.has(companyId)) {
    return cache.get(companyId)!;
  }
  const { users } = getCompanyPaths(companyId);
  try {
    const data = await fs.readFile(users, "utf8");
    const parsed = JSON.parse(data);
    cache.set(companyId, parsed);
    return parsed;
  } catch {
    cache.set(companyId, []);
    return [];
  }
}


export async function writeUsers(companyId: string, users: any[]) {
  const { users: usersPath } = getCompanyPaths(companyId);
  await acquireLock(companyId);
  try {
    await fs.mkdir(path.dirname(usersPath), { recursive: true });
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
    cache.set(companyId, users);
  } finally {
    releaseLock(companyId);
  }
}


export async function logEvent(companyId: string, event: any, metadata: any = {}) {
  const { history } = getCompanyPaths(companyId);
  await acquireLock(companyId);
  try {
    await fs.mkdir(path.dirname(history), { recursive: true });
    const historyArr = await readHistory(companyId);
    historyArr.push({
      ...event,
      version: 1,
      timestamp: new Date().toISOString(),
      metadata,
    });
    await fs.writeFile(history, JSON.stringify(historyArr, null, 2));
  } finally {
    releaseLock(companyId);
  }
}
// UPDATE usuário
export async function updateUser(companyId: string, userId: string, updates: any, metadata: any = {}) {
  const users = await readUsers(companyId);
  const idx = users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeUsers(companyId, users);
  await logEvent(companyId, { type: "USER_UPDATED", user: users[idx] }, metadata);
  return users[idx];
}

// SOFT DELETE usuário
export async function softDeleteUser(companyId: string, userId: string, metadata: any = {}) {
  const users = await readUsers(companyId);
  const idx = users.findIndex((u: any) => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], deletedAt: new Date().toISOString() };
  await writeUsers(companyId, users);
  await logEvent(companyId, { type: "USER_DELETED", user: users[idx] }, metadata);
  return users[idx];
}

export async function readHistory(companyId: string) {
  const { history } = getCompanyPaths(companyId);
  try {
    const data = await fs.readFile(history, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}
