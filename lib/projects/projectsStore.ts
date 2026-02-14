import fs from "fs/promises";
import path from "path";

export type ProjectRecord = {
/**
 * Estrutura de um projeto de suporte.
 */
  id: string;
  code?: string | null;
  title: string;
  description?: string | null;
  companyId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

// Caminho do arquivo de persistência dos projetos
const FILE_PATH = path.join(process.cwd(), "data", "support-projects.json");

async function readFile(): Promise<ProjectRecord[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw) as ProjectRecord[];
  } catch {
    return [];
  }
}

// Persiste todos os projetos no arquivo
async function writeFile(items: ProjectRecord[]) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

export const ProjectsStore = {
  /** Store de projetos de suporte persistido em arquivo JSON. */
  async listAll(): Promise<ProjectRecord[]> {
    return await readFile();
  },

  async listByCompany(companyId: string): Promise<ProjectRecord[]> {
    const all = await readFile();
    return all.filter((p) => p.companyId === companyId);
  },

  /** Busca projeto por ID */
  async getById(id: string): Promise<ProjectRecord | null> {
    const all = await readFile();
    return all.find((p) => p.id === id) ?? null;
  },

  async create(record: ProjectRecord): Promise<ProjectRecord> {
    const all = await readFile();
    all.push(record);
    await writeFile(all);
    return record;
  },

  /** Atualiza um projeto existente */
  async update(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    const all = await readFile();
    const idx = all.findIndex((p) => p.id === id && (!updates.companyId || p.companyId === updates.companyId));
    if (idx === -1) return null;
    const updated = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await writeFile(all);
    return updated;
  },

  async delete(id: string, companyId?: string | null): Promise<boolean> {
    const all = await readFile();
    const filtered = all.filter((p) => !(p.id === id && (!companyId || p.companyId === companyId)));
    const changed = filtered.length < all.length;
    if (changed) await writeFile(filtered);
    return changed;
  },
};
