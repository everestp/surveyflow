export interface CreateUserInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: "admin";
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  role: "admin";
  created_at: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "admin";
}
