import "server-only";

export type JiraCloudValidationResult =
  | {
      valid: true;
      accountId: string | null;
      accountName: string | null;
      baseUrl: string;
    }
  | {
      valid: false;
      errorMessage: string;
      status: number | null;
      baseUrl: string;
    };

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function buildBasicAuth(email: string, apiToken: string) {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

export async function validateJiraCloudCredentials(input: {
  baseUrl: string;
  email: string;
  apiToken: string;
}): Promise<JiraCloudValidationResult> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const email = input.email.trim();
  const apiToken = input.apiToken.trim();

  if (!baseUrl || !email || !apiToken) {
    return {
      valid: false,
      errorMessage: "Informe URL base, e-mail tecnico e API token do Jira.",
      status: 400,
      baseUrl,
    };
  }

  let url: URL;
  try {
    url = new URL(`${baseUrl}/rest/api/3/myself`);
  } catch {
    return {
      valid: false,
      errorMessage: "Informe uma URL base valida do Jira Cloud.",
      status: 400,
      baseUrl,
    };
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: buildBasicAuth(email, apiToken),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? "Credenciais do Jira invalidas ou sem permissao para acessar a conta atual."
          : "Nao foi possivel validar a integracao com o Jira.";
      return {
        valid: false,
        errorMessage: message,
        status: response.status,
        baseUrl,
      };
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const accountId = typeof payload?.accountId === "string" ? payload.accountId : null;
    const accountName =
      typeof payload?.displayName === "string"
        ? payload.displayName
        : typeof payload?.emailAddress === "string"
          ? payload.emailAddress
          : null;

    return {
      valid: true,
      accountId,
      accountName,
      baseUrl,
    };
  } catch {
    return {
      valid: false,
      errorMessage: "Nao foi possivel conectar ao Jira Cloud com as credenciais informadas.",
      status: null,
      baseUrl,
    };
  }
}
