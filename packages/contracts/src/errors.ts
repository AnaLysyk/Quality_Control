import { z } from "zod";

/**
 * Schema de resposta de erro padrão da API.
 */
export const ErrorResponseSchema = z
  .object({
    error: z.string().min(1),
    code: z.string().min(1).optional(),
  })
  .strip();

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
