import type {
  AuthUser,
  CreateUserInput,
  User,
  UserRole,
} from "./auth.types.js";

export interface IAuthRepository {
  createFirstAdmin(input: CreateUserInput): Promise<User>;

  findByEmail(email: string): Promise<AuthUser | null>;

  findById(id: string): Promise<User | null>;
}

export interface IPasswordService {
  hash(password: string): Promise<string>;

  compare(password: string, passwordHash: string): Promise<boolean>;
}

export interface ITokenService {
  sign(user: User): string;

  verify(token: string): {
    sub: string;
    email: string;
    role: UserRole;
  };
}
