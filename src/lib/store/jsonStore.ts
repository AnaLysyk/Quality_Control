import fs from 'fs';
import path from 'path';
import kvStore from './kvStore';

const DATA_DIR = path.resolve(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileForKey(key: string) {
  ensureDataDir();
  return path.join(DATA_DIR, `${key}.json`);
}

function readRawLocal(key: string) {
  const file = fileForKey(key);
  if (!fs.existsSync(file)) return { items: [] };
  try {
    const txt = fs.readFileSync(file, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return { items: [] };
  }
}

function writeRawLocal(key: string, data: any) {
  const file = fileForKey(key);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

async function readRaw(key: string) {
  // prefer KV if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const r = await kvStore.get(key);
      if (r) return r;
    } catch (e) {
      // fallthrough to local
    }
  }
  return readRawLocal(key);
}

async function writeRaw(key: string, data: any) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await kvStore.set(key, data);
      return;
    } catch (e) {
      // fallback to local
    }
  }
  writeRawLocal(key, data);
}

export async function listItems<T = any>(key: string): Promise<T[]> {
  const raw = await readRaw(key);
  return raw.items || [];
}

export async function saveList<T = any>(key: string, items: T[]) {
  await writeRaw(key, { items });
}

export async function pushItem<T = any>(key: string, item: T & { id?: string }) {
  const items = await listItems<T>(key);
  items.push(item as any);
  await saveList(key, items);
}

export async function updateItem<T = any>(key: string, id: string, patch: Partial<T>) {
  const items = await listItems<T & { id?: string }>(key);
  const idx = items.findIndex((i) => (i as any).id === id);
  if (idx === -1) return null;
  const updated = { ...items[idx], ...(patch as any) };
  items[idx] = updated as any;
  await saveList(key, items);
  return updated;
}

export async function findItem<T = any>(key: string, idOrFn: string | ((i: any) => boolean)) {
  const items = await listItems<T>(key);
  if (typeof idOrFn === 'string') return items.find((i: any) => i.id === idOrFn) || null;
  return items.find(idOrFn) || null;
}

export default { listItems, saveList, pushItem, updateItem, findItem };
