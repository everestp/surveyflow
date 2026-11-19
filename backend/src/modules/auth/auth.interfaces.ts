import type {
  AuthUser,
  CreateUserInput,
  User,
  UserRole,
} from "./auth.types.js";

export interface IAuthRepository {
  createUser(input: CreateUserInput): Promise<User>;

  createFirstAdmin(input: CreateUserInput): Promise<User>;

  findByEmail(email: string): Promise<AuthUser | null>;

  findById(id: string): Promise<User | null>;
}
