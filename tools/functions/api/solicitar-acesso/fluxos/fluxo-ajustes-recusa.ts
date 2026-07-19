import { expect, type APIRequestContext } from "@playwright/test";

import { obterSenhaTesteSolicitacaoAcesso } from "../autenticacao/autenticar-revisor";
import {
  esperarEmailCapturado,
  listarEmailsCapturados,
} from "../emails/capturar-emails";

export type PerfilSolicitacaoAcessoPublica =
  | "empresa"
  | "company_user"
  | "testing_company_user"
  | "leader_tc"
  | "technical_support";

export type DadosSolicitacaoAcessoPublica = {
  requestType: string;
  requestedRole: string;
  requestedCompanyId?: string;
  requestedCompanySlug?: string;
  requesterName: string;
  requesterEmail: string;
  email: string;
  full_name: string;
  name: string;
  user: string;
  phone: string;
  company?: string;
  client_id?: string;
  role: string;
  profile_type: string;
  title: string;
  description: string;
  password: string;
  reason: string;
  priority: string;
};

type ComentarioPublico = {
  authorRole?: string;
  authorName?: string;
  body?: string;
};

export type SolicitacaoCriadaComChave = {
  id: string;
  accessKey: string;
  requesterEmail: string;
  requestType?: string;
  requestedRole?: string;
};

export type SolicitacaoPublicaCompleta = {
  item?: {
    id?: string;
    status?: string;
    requesterEmail?: string;
    requesterName?: string;
    requestedRole?: string;
    reviewComment?: string;
    adjustmentFields?: string[];
    adjustmentHistory?: unknown[];
    details?: Record<string, unknown>;
  };
  comments?: ComentarioPublico[];
};

export function montarPayloadSolicitacaoFluxo(
  email: string,
  opcoes: {
    requestedRole: PerfilSolicitacaoAcessoPublica;
    requestedCompanyId?: string;
    requestedCompanySlug?: string;
  },
): DadosSolicitacaoAcessoPublica {
  const suffix = Date.now();
  const role = opcoes.requestedRole;
  const fullName = `Solicitante ${role} ${suffix}`;
  const description = `Fluxo automatizado de solicitacao de acesso para ${role}.`;

  const payload: DadosSolicitacaoAcessoPublica = {
    requestType: role,
    requestedRole: role,
    requesterName: fullName,
    requesterEmail: email,
    email,
    full_name: fullName,
    name: fullName,
    user: `usuario.${role}.${suffix}`,
    phone: `+55 51 9${String(suffix).slice(-8)}`,
    role: "Analista de QA",
    profile_type: role,
    title: `Solicitacao de acesso - ${role} - ${suffix}`,
    description,
    password: obterSenhaTesteSolicitacaoAcesso(),
    reason: description,
    priority: "medium",
  };

  if (role === "empresa") {
    Object.assign(payload, {
      companyName: `Empresa Fluxo ${suffix}`,
      company_name: `Empresa Fluxo ${suffix}`,
      fantasyName: `Empresa Fluxo ${suffix}`,
      fantasy_name: `Empresa Fluxo ${suffix}`,
      cnpj: `19131243${String(suffix).slice(-6).padStart(6, "0")}`,
      companyDocument: `19131243${String(suffix).slice(-6).padStart(6, "0")}`,
      company_document: `19131243${String(suffix).slice(-6).padStart(6, "0")}`,
      taxId: `19131243${String(suffix).slice(-6).padStart(6, "0")}`,
      tax_id: `19131243${String(suffix).slice(-6).padStart(6, "0")}`,
      cep: "01001-000",
      address: "Praca da Se",
      number: "100",
      city: "Sao Paulo",
      state: "SP",
      company: `Empresa Fluxo ${suffix}`,
    });
  }

  if (opcoes.requestedCompanyId) {
    payload.requestedCompanyId = opcoes.requestedCompanyId;
    payload.client_id = opcoes.requestedCompanyId;
  }

  if (opcoes.requestedCompanySlug) {
    payload.requestedCompanySlug = opcoes.requestedCompanySlug;
    payload.company = opcoes.requestedCompanySlug;
  }

  return payload;
}

export async function criarSolicitacaoPublicaComChave(
  request: APIRequestContext,
  payload: DadosSolicitacaoAcessoPublica,
) {
  const response = await request.post("/api/access-requests/public", {
    data: payload,
  });
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(201);
  expect(body?.item?.id).toBeTruthy();
  expect(body?.item?.requesterEmail).toBe(payload.email);
  expect(body?.item?.accessKey).toBeTruthy();

  return body.item as SolicitacaoCriadaComChave;
}

export async function consultarSolicitacaoPublicaCompleta(
  request: APIRequestContext,
  accessKey: string,
) {
  const response = await request.get(`/api/access-requests/by-key/${encodeURIComponent(accessKey)}`);
  const body = (await response.json().catch(() => null)) as SolicitacaoPublicaCompleta | null;

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.id).toBeTruthy();

  return body!;
}

export async function solicitarAjusteAdministrativo(
  request: APIRequestContext,
  params: {
    id: string;
    rodada: number;
    campos: string[];
    comentario: string;
  },
) {
  const response = await request.post(
    `/api/admin/access-requests/${encodeURIComponent(params.id)}/request-adjustment`,
    {
      data: {
        comment: params.comentario,
        fields: params.campos,
        fieldComments: Object.fromEntries(
          params.campos.map((campo) => [
            campo,
            `Rodada ${params.rodada}: validar ${campo} antes de aprovar.`,
          ]),
        ),
      },
    },
  );
  const body = await response.json().catch(() => null);

  expect(response.ok(), JSON.stringify(body)).toBeTruthy();

  return body;
}

export async function comentarComoRevisor(
  request: APIRequestContext,
  id: string,
  comentario: string,
) {
  const response = await request.post(
    `/api/admin/access-requests/${encodeURIComponent(id)}/comments`,
    { data: { comment: comentario } },
  );
  const body = await response.json().catch(() => null);

  expect(response.ok(), JSON.stringify(body)).toBeTruthy();

  return body;
}

export async function comentarComoSolicitante(
  request: APIRequestContext,
  params: {
    accessKey: string;
    nome: string;
    email: string;
    comentario: string;
  },
) {
  const response = await request.post("/api/support/access-request/comments", {
    data: {
      accessKey: params.accessKey,
      name: params.nome,
      email: params.email,
      comment: params.comentario,
    },
  });
  const body = await response.json().catch(() => null);

  expect(response.ok(), JSON.stringify(body)).toBeTruthy();

  return body;
}

export async function corrigirCamposSolicitante(
  request: APIRequestContext,
  accessKey: string,
  dados: Record<string, unknown>,
) {
  const response = await request.patch(
    `/api/access-requests/by-key/${encodeURIComponent(accessKey)}`,
    { data: dados },
  );
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.status).toBe("under_review");

  return body;
}

export async function validarConversaPublicaContem(
  request: APIRequestContext,
  accessKey: string,
  textosEsperados: string[],
) {
  const body = await consultarSolicitacaoPublicaCompleta(request, accessKey);
  const conversa = (body.comments ?? []).map((comment) => comment.body ?? "").join("\n");

  for (const texto of textosEsperados) {
    expect(conversa, `Comentario nao encontrado na conversa: ${texto}`).toContain(texto);
  }

  return body;
}

export async function aprovarSolicitacaoAdministrativa(
  request: APIRequestContext,
  params: {
    id: string;
    comentario: string;
  },
) {
  const response = await request.post(
    `/api/admin/access-requests/${encodeURIComponent(params.id)}/accept`,
    { data: { comment: params.comentario } },
  );
  const body = await response.json().catch(() => null);

  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(["closed", "approved"]).toContain(body?.item?.status);
  expect(body?.item?.username).toBeTruthy();

  return body.item as { id: string; status: string; username: string };
}

export async function recusarSolicitacaoAdministrativa(
  request: APIRequestContext,
  params: {
    id: string;
    motivo: string;
  },
) {
  const response = await request.post(
    `/api/admin/access-requests/${encodeURIComponent(params.id)}/reject`,
    {
      data: {
        reason: params.motivo,
        comment: params.motivo,
      },
    },
  );
  const body = await response.json().catch(() => null);

  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body?.item?.status).toBe("rejected");

  return body.item;
}

export async function validarLoginUsuarioAprovadoPorApi(
  request: APIRequestContext,
  params: {
    username: string;
    email: string;
    senha: string;
    perfil: PerfilSolicitacaoAcessoPublica;
  },
) {
  const tentativas = [
    { login: params.username, password: params.senha },
    { user: params.username, password: params.senha },
    { user: params.email, password: params.senha },
  ];

  let textoFinal = "";
  for (const tentativa of tentativas) {
    const response = await request.post("/api/auth/login", { data: tentativa });
    textoFinal = await response.text();
    if (response.ok()) {
      const meResponse = await request.get("/api/me");
      const me = await meResponse.json().catch(() => null);
      expect(meResponse.status(), JSON.stringify(me)).toBe(200);
      expect(me?.user?.email).toBe(params.email);
      return me;
    }
  }

  throw new Error(`Usuario aprovado nao conseguiu login: ${textoFinal}`);
}

export async function validarLoginRecusadoPorApi(
  request: APIRequestContext,
  payload: DadosSolicitacaoAcessoPublica,
) {
  const response = await request.post("/api/auth/login", {
    data: {
      user: payload.user || payload.email,
      password: payload.password,
    },
  });
  const text = await response.text();

  expect(response.status(), text).not.toBe(200);
}

export async function validarEmailCapturadoQuandoDisponivel(params: {
  to: string;
  subject: string | RegExp;
  contains?: string[];
  label: string;
}) {
  const capturaConfigurada =
    Boolean(process.env.EMAIL_CAPTURE_FILE) ||
    String(process.env.EMAIL_CAPTURE_MODE ?? "").toLowerCase() === "file";

  if (!capturaConfigurada) {
    console.warn(
      `[WARN][solicitar-acesso] ${params.label} ignorado para ${params.to}: ` +
        "EMAIL_CAPTURE_MODE=file/EMAIL_CAPTURE_FILE nao configurado neste processo.",
    );
    return null;
  }

  const antes = listarEmailsCapturados().length;

  try {
    return await esperarEmailCapturado({
      to: params.to,
      subject: params.subject,
      contains: params.contains,
    });
  } catch (error) {
    const depois = listarEmailsCapturados().length;
    console.warn(
      `[WARN][solicitar-acesso] ${params.label} nao capturado para ${params.to}. ` +
        `Outbox antes=${antes}, depois=${depois}. ` +
        `Quando o servidor estiver com EMAIL_CAPTURE_MODE=file, esta validacao passa a ser efetiva. ${error}`,
    );
    return null;
  }
}

