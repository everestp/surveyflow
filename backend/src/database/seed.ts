
import "dotenv/config";
import { pool } from "./pool.js";
import { env } from "../config/env.js";
import logger from "../services/logger.service.js";
import { BcryptPasswordService } from "../services/password.service.js";

const seedDatabase = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be configured to seed the admin user",
    );
  }

  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes",
    );
  }

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    logger.info("Admin user already exists", { email });
    return;
  }

  const passwordService = new BcryptPasswordService();
  const passwordHash = await passwordService.hash(password);

  await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'admin')`,
    [email, passwordHash],
  );

  logger.info("Admin user seeded successfully", { email });
};

seedDatabase()
  .catch((error: unknown) => {
    logger.error("Database seeding failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
