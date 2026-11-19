import type { UserRole } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };

      validatedQuery?: Record<string, unknown>;
    }
  }
}

export {};
