import { z } from "zod";

/**
 * String opcional, vazia vira undefined.
 */
const OptionalStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1));

/**
 * Aceita string ou array de string, normaliza para array.
 */
const OptionalStringOrStringArraySchema = z
  .union([OptionalStringSchema, z.array(z.string().min(1))])
  .optional()
  .transform((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string" && val.length > 0) return [val];
    return [];
  });

/**
 * Schema de cliente (camelCase, campos normalizados).
 */
export const ClientSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    companyName: z.string().optional().nullable(),
    slug: z.string().optional().nullable(),
    taxId: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    docsUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    cep: z.string().optional().nullable(),
    addressDetail: z.string().optional().nullable(),
    linkedinUrl: z.string().optional().nullable(),
    qaseProjectCode: z.string().optional().nullable(),
    qaseProjectCodes: z.array(z.string().min(1)).optional().nullable(),
    qaseToken: z.string().optional().nullable(),
    jiraBaseUrl: z.string().optional().nullable(),
    jiraEmail: z.string().email().optional().nullable(),
    jiraUsername: z.string().optional().nullable(),
    jiraApiToken: z.string().optional().nullable(),
    integrationMode: z.enum(["none", "qase", "jira", "manual", "other"]).optional().nullable(),
    shortDescription: z.string().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    extraNotes: z.string().optional().nullable(),
    status: z.enum(["active", "inactive", "archived"]).optional().nullable(),
    active: z.boolean().optional(),
    updatedAt: z.string().optional().nullable(),
    createdAt: z.string().optional().nullable(),
    createdBy: z.string().optional().nullable(),
  })
  .strip();

export type Client = z.infer<typeof ClientSchema>;

/**
 * Resposta de listagem de clientes.
 */
export const ClientListResponseSchema = z
  .object({
    items: z.array(ClientSchema),
  })
  .strip();

export type ClientListResponse = z.infer<typeof ClientListResponseSchema>;

/**
 * Requisição para criação de cliente.
 */
export const ClientCreateRequestSchema = z
  .object({
    name: OptionalStringSchema.optional(),
    companyName: OptionalStringSchema.optional(),
    taxId: OptionalStringSchema.optional(),
    address: OptionalStringSchema.optional(),
    phone: OptionalStringSchema.optional(),
    website: OptionalStringSchema.optional(),
    logoUrl: OptionalStringSchema.optional(),
    docsUrl: OptionalStringSchema.optional(),
    notes: OptionalStringSchema.optional(),
    description: OptionalStringSchema.optional(),
    qaseProjectCode: OptionalStringSchema.optional(),
    qaseProjectCodes: OptionalStringOrStringArraySchema,
    qaseToken: OptionalStringSchema.optional(),
    jiraBaseUrl: OptionalStringSchema.optional(),
    jiraEmail: z.string().email().optional(),
    jiraApiToken: OptionalStringSchema.optional(),
    integrationMode: z.enum(["none", "qase", "jira", "manual", "other"]).optional(),
    status: z.enum(["active", "inactive", "archived"]).optional(),
    slug: OptionalStringSchema.optional(),
    active: z.boolean().optional(),
    cep: OptionalStringSchema.optional(),
    addressDetail: OptionalStringSchema.optional(),
    linkedinUrl: OptionalStringSchema.optional(),
    shortDescription: OptionalStringSchema.optional(),
    internalNotes: OptionalStringSchema.optional(),
    extraNotes: OptionalStringSchema.optional(),
  })
  .strip();

export type ClientCreateRequest = z.infer<typeof ClientCreateRequestSchema>;
