import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import logger from "../services/logger.service.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(currentDirectory, "migrations");

const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      const existing = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [filename],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        logger.info("Migration already applied", { filename });
        continue;
      }

      const filePath = path.join(migrationsDirectory, filename);
      const sql = await readFile(filePath, "utf8");

      logger.info("Running migration", { filename });

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename],
        );

        await client.query("COMMIT");

        logger.info("Migration completed", { filename });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    logger.info("All database migrations completed");
  } finally {
    client.release();
  }
};

runMigrations()
  .catch((error: unknown) => {
    logger.error("Database migration failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
