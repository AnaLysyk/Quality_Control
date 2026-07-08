import { type NextRequest, NextResponse } from "next/server";

import { resolveBrainAccess } from "@/lib/brain/access";
import {
  BrainProviderSensitivePayloadError,
  canManageBrainProviderConfig,
  getBrainProviderConfigAdminPayload,
  isBrainProviderConfigStorageUnavailable,
  updateBrainProviderConfigs,
} from "@/lib/brain/providerConfig";

const MIGRATION_ERROR = "Tabelas de configuracao dos providers do Brain ainda nao existem. Aplique a migration 20260708153000_add_brain_provider_config.";

function migrationResponse(status = 503) {
  return NextResponse.json({
    requiresMigration: true,
    error: MIGRATION_ERROR,
  }, { status });
}

async function requireBrainProviderConfigAccess(req: NextRequest) {
  const accessResult = await resolveBrainAccess(req);
  if (!accessResult.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: accessResult.error }, { status: accessResult.status }),
    };
  }

  if (!canManageBrainProviderConfig(accessResult.context)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sem permissao para configurar providers do Brain" }, { status: 403 }),
    };
  }

  return { ok: true as const, context: accessResult.context };
}

export async function GET(req: NextRequest) {
  const guard = await requireBrainProviderConfigAccess(req);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await getBrainProviderConfigAdminPayload());
  } catch (error) {
    if (isBrainProviderConfigStorageUnavailable(error)) return migrationResponse();
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao consultar configuracao dos providers do Brain",
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireBrainProviderConfigAccess(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));
    const runtime = await updateBrainProviderConfigs(guard.context, body);
    return NextResponse.json({
      configs: runtime.configs.map((config) => ({
        provider: config.provider,
        enabled: config.enabled,
        model: config.model,
        models: config.models,
        priority: config.priority,
        dailyRequestLimit: config.dailyRequestLimit,
        dailyTokenLimit: config.dailyTokenLimit,
        strictFreeModels: config.strictFreeModels,
        timeoutMs: config.timeoutMs,
        maxOutputTokens: config.maxOutputTokens,
      })),
      keyStatus: runtime.keyStatus,
    });
  } catch (error) {
    if (error instanceof BrainProviderSensitivePayloadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isBrainProviderConfigStorageUnavailable(error)) return migrationResponse();

    const message = error instanceof Error ? error.message : "Erro ao atualizar configuracao dos providers do Brain";
    const status = /permissao/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
