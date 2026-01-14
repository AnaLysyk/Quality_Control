import { z } from "zod";

const OptionalStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1));

const OptionalStringOrStringArraySchema = z
  .union([OptionalStringSchema, z.array(z.string().min(1))])
  .optional();

export const ClientSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    company_name: z.string().optional().nullable(),
    slug: z.string().optional().nullable(),
    tax_id: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    website: z.string().optional().nullable(),
    logo_url: z.string().optional().nullable(),
    docs_link: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    cep: z.string().optional().nullable(),
    address_detail: z.string().optional().nullable(),
    linkedin_url: z.string().optional().nullable(),
    qase_project_code: z.string().optional().nullable(),
    qase_project_codes: z.array(z.string().min(1)).optional().nullable(),
    qase_token: z.string().optional().nullable(),
    jira_base_url: z.string().optional().nullable(),
    jira_email: z.string().optional().nullable(),
    jira_username: z.string().optional().nullable(),
    jira_api_token: z.string().optional().nullable(),
    integration_mode: z.enum(["none", "qase", "jira", "manual", "other"]).optional().nullable(),
    integration_type: z.enum(["none", "qase", "jira", "manual", "other"]).optional().nullable(),
    short_description: z.string().optional().nullable(),
    internal_notes: z.string().optional().nullable(),
    extra_notes: z.string().optional().nullable(),
    status: z.enum(["active", "inactive", "archived"]).optional().nullable(),
    active: z.boolean().optional(),
    updated_at: z.string().optional().nullable(),
    created_at: z.string().optional().nullable(),
    created_by: z.string().optional().nullable(),
  })
  .strip();

export type Client = z.infer<typeof ClientSchema>;

export const ClientListResponseSchema = z
  .object({
    items: z.array(ClientSchema),
  })
  .strip();

export type ClientListResponse = z.infer<typeof ClientListResponseSchema>;

export const ClientCreateRequestSchema = z
  .object({
    name: OptionalStringSchema.optional(),
    company_name: OptionalStringSchema.optional(),
    tax_id: OptionalStringSchema.optional(),
    address: OptionalStringSchema.optional(),
    phone: OptionalStringSchema.optional(),
    website: OptionalStringSchema.optional(),
    logo_url: OptionalStringSchema.optional(),
    docs_link: OptionalStringSchema.optional(),
    docs_url: OptionalStringSchema.optional(),
    notes: OptionalStringSchema.optional(),
    description: OptionalStringSchema.optional(),
    qase_project_code: OptionalStringSchema.optional(),
    qase_project_codes: OptionalStringOrStringArraySchema,
    qase_token: OptionalStringSchema.optional(),
    jira_base_url: OptionalStringSchema.optional(),
    jira_email: OptionalStringSchema.optional(),
    jira_api_token: OptionalStringSchema.optional(),
    integration_mode: z.enum(["none", "qase", "jira", "manual", "other"]).optional(),
    status: z.enum(["active", "inactive", "archived"]).optional(),
    slug: OptionalStringSchema.optional(),
    active: z.boolean().optional(),
    cep: OptionalStringSchema.optional(),
    address_detail: OptionalStringSchema.optional(),
    linkedin_url: OptionalStringSchema.optional(),
    short_description: OptionalStringSchema.optional(),
    internal_notes: OptionalStringSchema.optional(),
    extra_notes: OptionalStringSchema.optional(),
  })
  .strip();

export type ClientCreateRequest = z.infer<typeof ClientCreateRequestSchema>;
