import { z } from "zod";

export const PaginationSchema = z
  .object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(200),
    total: z.number().int().min(0),
  })
  .strict();

export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(20),
  })
  .strip();

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
