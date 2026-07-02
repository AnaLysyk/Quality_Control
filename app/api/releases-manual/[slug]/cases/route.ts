import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { readManualReleaseCases, writeManualReleaseCases, type ManualCaseItem } from "@/lib/manualReleaseStore";

function normalizeItem(raw: Record<string, unknown>): ManualCaseItem | null {
  const id = raw.id ?? raw.caseId ?? raw.case_id;
  if (!id) return null;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [];
  return {
    id: String(id),
    title: typeof raw.title === "string" ? raw.title : undefined,
    link: typeof raw.link === "string" ? raw.link : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    bug: typeof raw.bug === "string" ? raw.bug : null,
    fromApi: Boolean(raw.fromApi ?? raw.from_api),
    origin: typeof raw.origin === "string" ? raw.origin : null,
    type: typeof raw.type === "string" ? raw.type : null,
    projectCode: typeof raw.projectCode === "string" ? raw.projectCode : null,
    suiteId: typeof raw.suiteId === "string" ? raw.suiteId : null,
    suiteName: typeof raw.suiteName === "string" ? raw.suiteName : null,
    description: typeof raw.description === "string" ? raw.description : null,
    preconditions:
      typeof raw.preconditions === "string"
        ? raw.preconditions
        : typeof raw.precondition === "string"
          ? raw.precondition
          : null,
    postconditions:
      typeof raw.postconditions === "string"
        ? raw.postconditions
        : typeof raw.postcondition === "string"
          ? raw.postcondition
          : null,
    stepsText: typeof raw.stepsText === "string" ? raw.stepsText : typeof raw.steps === "string" ? raw.steps : null,
    expectedText: typeof raw.expectedText === "string" ? raw.expectedText : typeof raw.expected === "string" ? raw.expected : null,
    priority: typeof raw.priority === "string" ? raw.priority : null,
    severity: typeof raw.severity === "string" ? raw.severity : null,
    tags,
    responsibleName: typeof raw.responsibleName === "string" ? raw.responsibleName : null,
    defectsCount: Number(raw.defectsCount ?? 0) || 0,
    evidencesCount: Number(raw.evidencesCount ?? 0) || 0,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    finishedAt: typeof raw.finishedAt === "string" ? raw.finishedAt : null,
    statusUpdatedAt: typeof raw.statusUpdatedAt === "string" ? raw.statusUpdatedAt : null,
    retestCount: Number(raw.retestCount ?? 0) || 0,
  };
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { slug } = await context.params;
  const store = await readManualReleaseCases();
  const items = Array.isArray(store[slug]) ? store[slug] : [];
  return NextResponse.json(items);
}

export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { slug } = await context.params;
  const body = (await req.json().catch(() => null)) as unknown;
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const store = await readManualReleaseCases();
  const list = Array.isArray(store[slug]) ? store[slug] : [];

  const payload = Array.isArray(body) ? body : [body];
  payload.forEach((row) => {
    const item = normalizeItem((row ?? {}) as Record<string, unknown>);
    if (!item) return;
    list.push(item);
  });

  store[slug] = list;
  await writeManualReleaseCases(store);
  return NextResponse.json(list, { status: 201 });
}

export async function PATCH(req: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { slug } = await context.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const store = await readManualReleaseCases();
  const list = Array.isArray(store[slug]) ? store[slug] : [];
  const incoming = normalizeItem(body);
  if (!incoming) return NextResponse.json({ message: "Item invalido" }, { status: 400 });

  const index = list.findIndex((item) => String(item.id) === incoming.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...incoming };
  } else {
    list.push(incoming);
  }

  store[slug] = list;
  await writeManualReleaseCases(store);
  return NextResponse.json(incoming);
}

export async function PUT(req: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { slug } = await context.params;
  const body = (await req.json().catch(() => null)) as unknown;
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const payload = Array.isArray(body) ? body : [];
  const list = payload
    .map((row) => normalizeItem((row ?? {}) as Record<string, unknown>))
    .filter((item): item is ManualCaseItem => item !== null);

  const store = await readManualReleaseCases();
  store[slug] = list;
  await writeManualReleaseCases(store);
  return NextResponse.json(list);
}

export async function DELETE(req: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { slug } = await context.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const id = body.id ?? body.caseId ?? body.case_id;
  if (!id) return NextResponse.json({ message: "ID obrigatório" }, { status: 400 });

  const store = await readManualReleaseCases();
  const list = Array.isArray(store[slug]) ? store[slug] : [];
  store[slug] = list.filter((item) => String(item.id) !== String(id));
  await writeManualReleaseCases(store);
  return NextResponse.json({ ok: true });
}

