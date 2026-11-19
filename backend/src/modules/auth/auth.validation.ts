import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password must contain at least 12 characters")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password must not exceed 72 UTF-8 bytes",
  );

export const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginRequestInput = z.infer<typeof loginSchema>;
