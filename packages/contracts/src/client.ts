import { z } from "zod";

const OptionalStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1));

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
    active: z.boolean().optional(),
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
    active: z.boolean().optional(),
  })
  .strip();

export type ClientCreateRequest = z.infer<typeof ClientCreateRequestSchema>;
