import { expect } from "@playwright/test";
import Ajv, {
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});

addFormats(ajv);

const validadores = new WeakMap<object, ValidateFunction>();

function formatarCaminho(erro: ErrorObject): string {
  if (erro.keyword === "required") {
    const propriedade = String(erro.params.missingProperty ?? "");
    return `${erro.instancePath || ""}/${propriedade}` || "/";
  }

  if (erro.keyword === "additionalProperties") {
    const propriedade = String(erro.params.additionalProperty ?? "");
    return `${erro.instancePath || ""}/${propriedade}` || "/";
  }

  return erro.instancePath || "/";
}

export function formatarErrosContrato(
  erros: ErrorObject[] | null | undefined,
): string {
  if (!erros?.length) return "Contrato invalido sem detalhes do AJV.";

  return erros
    .map((erro) => {
      const mensagem = erro.message ?? `falhou na regra ${erro.keyword}`;
      return `- ${formatarCaminho(erro)}: ${mensagem}`;
    })
    .join("\n");
}

function obterValidador(schema: AnySchema): ValidateFunction {
  if (typeof schema !== "object" || schema === null) {
    return ajv.compile(schema);
  }

  const validadorExistente = validadores.get(schema);
  if (validadorExistente) return validadorExistente;

  const validador = ajv.compile(schema);
  validadores.set(schema, validador);
  return validador;
}

export function validarContratoApi(
  schema: AnySchema,
  body: unknown,
  nomeContrato = "resposta da API",
): void {
  const validar = obterValidador(schema);
  const valido = validar(body);
  const detalhes = formatarErrosContrato(validar.errors);

  expect(
    valido,
    `Falha no contrato "${nomeContrato}":\n${detalhes}`,
  ).toBeTruthy();
}
