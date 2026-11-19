export type UserRole = "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface AuthUser extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}
