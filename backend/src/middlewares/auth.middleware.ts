import type { RequestHandler } from "express";
import type { ITokenService } from "../modules/auth/auth.interfaces.js";
import type { UserRole } from "../modules/auth/auth.types.js";
import { AppError } from "../utils/api-error.js";

export const createAuthMiddleware = (
  tokenService: ITokenService,
): RequestHandler => {
  return (req, _res, next) => {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    }

    try {
      const claims = tokenService.verify(token);

      req.user = {
        id: claims.sub,
        email: claims.email,
        role: claims.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const authorize = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "Access denied", "FORBIDDEN"));
    }

    next();
  };
};
