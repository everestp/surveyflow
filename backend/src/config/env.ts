import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  JWT_EXPIRES_IN: z.string().default("1d"),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("info"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    "Invalid environment configuration:",
    z.treeifyError(result.error),
  );

  process.exit(1);
}

export const env = Object.freeze(result.data);

export type Environment = typeof env;
