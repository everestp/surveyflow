import type { Pool, PoolClient } from "pg";
import type { IAuthRepository } from "./auth.interfaces.js";
import type { AuthUser, CreateUserInput, User } from "./auth.types.js";
import { AppError } from "../../utils/api-error.js";

interface UserRow {
  id: string;
  email: string;
  password_hash?: string;
  role: "admin";
  created_at: Date;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly db: Pool) {}

  private mapUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  async createFirstAdmin(input: CreateUserInput): Promise<User> {
    const client: PoolClient = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Prevent concurrent requests from creating two first admins.
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [73192, 1]);

      const countResult = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM users",
      );

      if (Number(countResult.rows[0].count) > 0) {
        throw new AppError(
          403,
          "Initial registration is already closed",
          "REGISTRATION_CLOSED",
        );
      }

      const result = await client.query<UserRow>(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'admin')
         RETURNING id, email, role, created_at`,
        [input.email, input.passwordHash],
      );

      await client.query("COMMIT");

      return this.mapUser(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, password_hash, role, created_at
       FROM users
       WHERE email = $1`,
      [email],
    );

    const row = result.rows[0];

    if (!row || !row.password_hash) {
      return null;
    }

    return {
      ...this.mapUser(row),
      passwordHash: row.password_hash,
    };
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      `SELECT id, email, role, created_at
       FROM users
       WHERE id = $1`,
      [id],
    );

    const row = result.rows[0];

    return row ? this.mapUser(row) : null;
  }
}
