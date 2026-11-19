import { pool } from "../../config/database.js";
import type { User } from "./auth.types.js";

export class AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query<User>(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await pool.query<User>(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING *`,
      [email, passwordHash],
    );

    return result.rows[0];
  }
}

export const authRepository = new AuthRepository();
