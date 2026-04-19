import { NextResponse } from "next/server";
import { z } from "zod";

import { BIOMETRIC_FIXTURE_DEFINITIONS } from "@/data/biometricFixtures";
import { getBiometricConfigPreview } from "@/lib/automations/biometrics/config";
import { resolveExistingLocalBiometricFixtures } from "@/lib/automations/biometrics/localFixtures";
import { saveAutomationExecutionAudit } from "@/lib/automations/executionAuditStore";
import {
  resolveAutomationAccess,
  resolveAutomationAllowedCompanySlugs,
} from "@/lib/automations/access";
import { authenticateRequest } from "@/lib/jwtAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z
  .object({
    advanced: z
      .object({
        host: z.string().trim().optional(),
        password: z.string().optional(),
        port: z.coerce.number().int().min(1).max(65535).optional(),
        user: z.string().trim().optional(),
      })
      .partial()
      .optional(),
    companySlug: z.string().trim().optional().nullable(),
    faceFixture: z.string().trim().optional().nullable(),
    fingerprint: z.object({
      fixture: z.string().trim().min(1),
      index: z.coerce.number().int().min(0).max(99).optional(),
    }),
    includeFace: z.boolean().optional(),
    mode: z.enum(["above", "below"]).optional(),
    processId: z.string().trim().optional().nullable(),
    protocol: z.string().trim().optional().nullable(),
    target: z.coerce.number().int().min(1).max(2_000_000).optional(),
  })
  .superRefine((data, context) => {
    if (!data.processId && !data.protocol) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe `processId` ou `protocol`.",
        path: ["processId"],
      });
    }
  });

function getAuthorizedContext(user: Awaited<ReturnType<typeof authenticateRequest>>) {
  const allowedCompanySlugs = resolveAutomationAllowedCompanySlugs(user);
  const access = resolveAutomationAccess(user, allowedCompanySlugs.length);
  return { access, allowedCompanySlugs };
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { access } = getAuthorizedContext(user);

  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const existingSlugs = new Set(resolveExistingLocalBiometricFixtures().map((fixture) => fixture.slug));
  const fixtures = BIOMETRIC_FIXTURE_DEFINITIONS.filter((fixture) => existingSlugs.has(fixture.slug));

  return NextResponse.json({
    access: {
      canConfigure: access.canConfigure,
      profileLabel: access.profileLabel,
      scopeLabel: access.scopeLabel,
    },
    defaults: {
      ...getBiometricConfigPreview(),
      faceFixture: "face",
      fingerprintFixture: "anelar-esquerdo",
      mode: "below",
    },
    fixtures,
  });
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  const startedAt = Date.now();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { access, allowedCompanySlugs } = getAuthorizedContext(user);

  if (!access.canOpen) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsedBody = await request.json().catch(() => null);
  const validation = RequestSchema.safeParse(parsedBody);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message || "Payload inválido" }, { status: 400 });
  }

  const payload = validation.data;
  const companySlug = payload.companySlug?.trim() || allowedCompanySlugs[0] || null;

  if (!access.hasGlobalCompanyVisibility && companySlug && !allowedCompanySlugs.includes(companySlug)) {
    return NextResponse.json({ error: "Empresa fora do escopo da sessão" }, { status: 403 });
  }

  try {
    const { runBiometricAttach } = await import("@/lib/automations/biometrics/attachRunner");
    const result = await runBiometricAttach({
      companySlug,
      config: access.canConfigure ? payload.advanced : undefined,
      faceFixture: payload.includeFace === false ? null : payload.faceFixture || "face",
      fingerprintFixture: payload.fingerprint.fixture,
      fingerprintIndex: payload.fingerprint.index,
      includeFace: payload.includeFace !== false,
      mode: payload.mode,
      processId: payload.processId,
      protocol: payload.protocol,
      target: payload.target,
    });

    await saveAutomationExecutionAudit({
      actorUserId: user.id,
      companySlug: result.companySlug,
      durationMs: result.durationMs,
      metadata: {
        fingerprintFixture: payload.fingerprint.fixture,
        includeFace: payload.includeFace !== false,
        mode: result.mode,
        processId: result.processId,
      },
      ok: true,
      route: "griaule-biometrics",
      statusCode: result.putStatus,
    });

    return NextResponse.json({
      ok: true,
      result: {
        afterSummary: result.afterSummary,
        beforeSummary: result.beforeSummary,
        companySlug: result.companySlug,
        durationMs: result.durationMs,
        faceIncluded: result.faceIncluded,
        fingerprintBase64Length: result.fingerprintBase64Length,
        fingerprintFormat: result.fingerprintFormat,
        fingerprintIndex: result.fingerprintIndex,
        fingerprintLabel: result.fingerprintLabel,
        host: access.canConfigure ? result.host : null,
        latestOutputPath: result.latestOutputPath,
        mode: result.mode,
        outputPath: result.outputPath,
        processId: result.processId,
        putStatus: result.putStatus,
        target: result.target,
        user: access.canConfigure ? result.user : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao executar o fluxo biométrico.";

    await saveAutomationExecutionAudit({
      actorUserId: user.id,
      durationMs: Date.now() - startedAt,
      error: message,
      ok: false,
      route: "griaule-biometrics",
      statusCode: 500,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
