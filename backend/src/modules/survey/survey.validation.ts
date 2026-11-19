import { z } from "zod";

const conditionSchema = z.object({
  questionId: z.string().uuid(),
  operator: z.enum(["equals", "not_equals", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const questionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(1000).optional(),
  type: z.enum([
    "text",
    "textarea",
    "number",
    "email",
    "single_choice",
    "multiple_choice",
    "rating",
    "date",
    "yes_no",
  ]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(200)).optional(),
  order: z.number().int().min(0),
  condition: conditionSchema.optional(),
});

const questionsSchema = z.array(questionSchema).max(100);

export const createSurveySchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  questions: questionsSchema.default([]),
});

export const updateSurveySchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  questions: questionsSchema.optional(),
});

export const surveyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export type CreateSurveyRequest = z.infer<typeof createSurveySchema>;
export type UpdateSurveyRequest = z.infer<typeof updateSurveySchema>;
