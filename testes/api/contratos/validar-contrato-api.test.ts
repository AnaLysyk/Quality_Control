import { describe, expect, it } from "@jest/globals";

import {
  formatarErrosContrato,
  validarContratoApi,
} from "../../../support/functions/api/contratos/validar-contrato-api";

const schema = {
  type: "object",
  required: ["item"],
  properties: {
    item: {
      type: "object",
      required: ["email", "createdAt"],
      properties: {
        email: { type: "string", format: "email" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
} as const;

describe("validarContratoApi", () => {
  it("aceita uma resposta compativel com o schema", () => {
    expect(() =>
      validarContratoApi(schema, {
        item: {
          email: "qa@example.com",
          createdAt: "2026-06-14T12:00:00.000Z",
        },
      }),
    ).not.toThrow();
  });

  it("informa o caminho dos campos invalidos", () => {
    expect(() =>
      validarContratoApi(
        schema,
        {
          item: {
            email: "email-invalido",
          },
        },
        "contrato de teste",
      ),
    ).toThrow(/\/item\/email/);

    expect(() =>
      validarContratoApi(
        schema,
        {
          item: {
            email: "qa@example.com",
          },
        },
        "contrato de teste",
      ),
    ).toThrow(/\/item\/createdAt/);
  });

  it("tem fallback quando o AJV nao fornece detalhes", () => {
    expect(formatarErrosContrato(null)).toBe(
      "Contrato invalido sem detalhes do AJV.",
    );
  });
});

