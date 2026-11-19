import { z } from "zod";

export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type TrendQuery = z.infer<typeof trendQuerySchema>;
