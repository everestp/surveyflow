import jwt from "jsonwebtoken";
import type { ITokenService } from "../modules/auth/auth.interfaces.js";
import type {
  AuthTokenPayload,
  User,
  UserRole,
} from "../modules/auth/auth.types.js";
import { AppError } from "../utils/api-error.js";

const VALID_ROLES: ReadonlySet<UserRole> = new Set(["admin", "user"]);

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.has(value as UserRole);
}

export class JwtTokenService implements ITokenService {
  private readonly expiresInSeconds = 3600;

  constructor(
    private readonly secret: string,
    private readonly issuer: string,
    private readonly audience: string,
  ) {}

  sign(user: User): string {
    return jwt.sign(
      {
        email: user.email,
        role: user.role,
      },
      this.secret,
      {
        subject: user.id,
        expiresIn: this.expiresInSeconds,
        issuer: this.issuer,
        audience: this.audience,
      },
    );
  }

  verify(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string" ||
        !isUserRole(payload.role)
      ) {
        throw new Error("Invalid JWT payload");
      }

      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new AppError(
        401,
        "Invalid or expired authentication token",
        "INVALID_TOKEN",
      );
    }
  }
}
