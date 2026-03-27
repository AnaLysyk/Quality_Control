import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  findLocalCompanyById,
  updateLocalCompany,
} from "@/lib/auth/localStore";

const BASE_DIR = path.join(process.cwd(), "data", "s3");
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function safeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function resolveTarget(key: string) {
  const target = path.resolve(BASE_DIR, key);
  const base = path.resolve(BASE_DIR);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    return null;
  }
  return target;
}

function extractObjectKey(logoUrl?: string | null) {
  if (!logoUrl) return null;
  const marker = "/api/s3/object?key=";
  const idx = logoUrl.indexOf(marker);
  if (idx === -1) return null;
  const raw = logoUrl.slice(idx + marker.length).trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function uploadAndPersistCompanyLogo(companyId: string, file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem valida");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A imagem deve ter no maximo 5 MB");
  }

  const ext = path.extname(file.name || "").toLowerCase() || ".png";
  const companySegment = safeSegment(companyId.trim());
  const key = path.posix.join("logos", `${companySegment}-${Date.now()}-${randomUUID()}${ext}`);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const target = resolveTarget(key);
  if (!target) {
    throw new Error("Arquivo invalido");
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);

  const logoUrl = `/api/s3/object?key=${encodeURIComponent(key)}`;
  const existing = await findLocalCompanyById(companyId.trim());
  if (existing) {
    const previousKey = extractObjectKey(existing.logo_url as string | null);
    if (previousKey && previousKey !== key) {
      const previousTarget = resolveTarget(previousKey);
      if (previousTarget) {
        await fs.rm(previousTarget, { force: true }).catch(() => undefined);
      }
    }
  }

  const updated = await updateLocalCompany(companyId.trim(), { logo_url: logoUrl });
  if (!updated) {
    throw new Error("Nao foi possivel atualizar o logo");
  }

  return { logoUrl };
}
