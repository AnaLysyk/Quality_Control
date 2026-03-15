import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
});

export const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.string(),
});

export const ticketSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(8).max(2000),
  createdBy: z.string(),
});

export const ticketDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(8).max(2000),
  type: z.enum(["tarefa", "bug", "melhoria"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const ticketCommentSchema = z.object({
  body: z.string().trim().min(3).max(2000),
});

export const assistantNoteSchema = z
  .object({
    title: z.string().trim().max(120).default(""),
    content: z.string().trim().max(12000).default(""),
  })
  .refine((value) => Boolean(value.title || value.content), {
    message: "Nota precisa ter titulo ou conteudo.",
    path: ["content"],
  });

export const assistantTestCaseSchema = z.object({
  sourceTitle: z.string().trim().min(3).max(120),
  objective: z.string().trim().min(12).max(600),
  reproductionBase: z.string().trim().min(12).max(500),
  expectedResult: z.string().trim().min(12).max(600),
});
