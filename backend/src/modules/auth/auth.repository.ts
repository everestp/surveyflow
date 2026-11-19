import type { Pool, PoolClient } from "pg";
import type { IAuthRepository } from "./auth.interfaces.js";
import type {
  AuthUser,
  CreateUserInput,
  User,
  UserRole,
} from "./auth.types.js";

interface UserRow {
  id: string;
  email: string;
  password_hash?: string;
  role: UserRole;
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

  async createUser(input: CreateUserInput): Promise<User> {
    const client: PoolClient = await this.db.connect();
    let inTransaction = false;

    try {
      await client.query("BEGIN");
      inTransaction = true;

      // Serialize initial user creation so concurrent first signups don't race.
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [73192, 1]);

      const countResult = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM users",
      );

      const role: UserRole =
        Number(countResult.rows[0].count) === 0 ? "admin" : "user";

      const result = await client.query<UserRow>(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, role, created_at`,
        [input.email, input.passwordHash, role],
      );

      await client.query("COMMIT");
      inTransaction = false;

      return this.mapUser(result.rows[0]);
    } catch (error) {
      if (inTransaction) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original error if rollback fails.
        }
      }
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
