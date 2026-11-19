import { z } from "zod";

const answerSchema = z.object({
  questionId: z.string().uuid(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export const submitResponseSchema = z.object({
  answers: z.array(answerSchema).min(1).max(100),
  respondentEmail: z.string().trim().email().max(255).optional(),
});

export const responseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SubmitResponseRequest = z.infer<typeof submitResponseSchema>;
