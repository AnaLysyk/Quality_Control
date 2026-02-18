import { z } from 'zod';

export const companySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2)
});

export const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.string(),
});

export const ticketSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  createdBy: z.string(),
});

// Adicione outros schemas conforme necessário
