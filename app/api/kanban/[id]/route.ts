import { NextResponse } from "next/server";

import store from "../store";
import type { Status } from "../types";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isAdmin(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "global_admin" || role === "company" || role === "company_admin";
}

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

function normalizeStatus(value: unknown): Status | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["PASS", "FAIL", "BLOCKED", "NOT_RUN"].includes(upper)) return upper as Status;

  const lower = raw.toLowerCase();
  if (lower === "pass" || lower === "passed") return "PASS";
  if (lower === "fail" || lower === "failed") return "FAIL";
  if (lower === "blocked") return "BLOCKED";
  if (lower === "notrun" || lower === "not_run" || lower === "not run" || lower === "untested") return "NOT_RUN";
  return null;
}

function asTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function findCard(id: number, user: AuthUser) {
  if (isAdmin(user)) {
    return store.find((c) => c.id === id) ?? null;
  }

  const allowed = resolveAllowedSlugs(user);
  if (!allowed.length) return null;
  return store.find((c) => c.id === id && c.client_slug && allowed.includes(c.client_slug)) ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNumber = Number(id);
  if (!Number.isFinite(idNumber)) {
    return jsonError("Id invalido", 400);
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("JSON invalido", 400);

  const user = await authenticateRequest(request);
  if (!user) return jsonError("Nao autorizado", 401);

  const card = findCard(idNumber, user);
  if (!card) return jsonError("Card nao encontrado", 404);

  const record = body as Record<string, unknown>;
  const nextStatus = record.status !== undefined ? normalizeStatus(record.status) : null;
  if (record.status !== undefined && !nextStatus) {
    return jsonError("Status invalido", 400);
  }

  if (record.title !== undefined) {
    const title = asTitle(record.title);
    if (!title) return jsonError("Title invalido", 400);
    card.title = title;
  }
  if (record.status !== undefined) card.status = nextStatus;
  if (record.bug !== undefined) card.bug = record.bug === null ? null : asOptionalString(record.bug);
  if (record.link !== undefined) card.link = record.link === null ? null : asOptionalString(record.link);

  return NextResponse.json(card);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNumber = Number(id);
  if (!Number.isFinite(idNumber)) {
    return jsonError("Id invalido", 400);
  }

  const user = await authenticateRequest(request);
  if (!user) return jsonError("Nao autorizado", 401);

  const idx = store.findIndex((c) => {
    if (c.id !== idNumber) return false;
    if (isAdmin(user)) return true;
    const allowed = resolveAllowedSlugs(user);
    if (!allowed.length) return false;
    return Boolean(c.client_slug && allowed.includes(c.client_slug));
  });
  if (idx === -1) return jsonError("Card nao encontrado", 404);

  const [removed] = store.splice(idx, 1);
  return NextResponse.json({ id: removed.id });
}
