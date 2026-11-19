import pg from "pg";
import { env } from "../config/env.js";
import logger from "../services/logger.service.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
});

pool.on("connect", () => {
  logger.debug("Database client connected");
});

pool.on("error", (error) => {
  logger.error("Unexpected database pool error", {
    message: error.message,
    stack: error.stack,
  });
});

export const checkDatabaseConnection = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    logger.info("Database connection established");
  } finally {
    client.release();
  }
};
