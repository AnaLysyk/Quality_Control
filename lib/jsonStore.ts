import fs from "fs";
import path from "path";

type User = { id: string; name: string; role: string; companies?: string[] };
type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdBy: string;
  companyId: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

function dataPath(file: string) {
  return path.join(process.cwd(), "data", file);
}

export function readJson(file: string): any {
  const p = dataPath(file);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function writeJson(file: string, data: any) {
  const p = dataPath(file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export function createTicket(user: User, payload: Partial<Ticket>): Ticket {
  const tickets: Ticket[] = readJson("tickets.json") ?? [];
  const id = `T-${Date.now()}`;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id,
    title: payload.title ?? "Sem título",
    description: payload.description ?? "",
    status: "open",
    priority: payload.priority ?? "medium",
    createdBy: user.id,
    companyId: user.companies?.[0] ?? (payload.companyId as string) ?? "",
    assignedTo: payload.assignedTo ?? null,
    createdAt: now,
    updatedAt: now,
    ...payload,
  };
  tickets.push(ticket);
  writeJson("tickets.json", tickets);

  // append event
  const events = readJson("ticket-events.json") ?? [];
  const ev = {
    id: `e-${Date.now()}`,
    ticketId: id,
    type: "ticket_created",
    from: null,
    to: null,
    userId: user.id,
    createdAt: now,
  };
  events.push(ev);
  writeJson("ticket-events.json", events);

  return ticket;
}

export function getTickets(user: User) {
  const tickets: Ticket[] = readJson("tickets.json") ?? [];
  if (!user) return [];
  const role = String(user.role || "").toLowerCase();
  if (role === "support" || role === "admin") return tickets;
  if (role === "company") {
    const companies = user.companies ?? [];
    return tickets.filter((t) => companies.includes(t.companyId));
  }
  return tickets.filter((t) => t.createdBy === user.id);
}

export default {
  readJson,
  writeJson,
  createTicket,
  getTickets,
};
