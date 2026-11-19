import { Router, type RequestHandler } from "express";

import type { AuthController } from "./auth.controller.js";
import type { ITokenService } from "./auth.interfaces.js";

import { createAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/api-error.js";

import { registerSchema, loginSchema } from "./auth.validation.js";

export const createAuthRoutes = (
  controller: AuthController,
  tokenService: ITokenService,
): Router => {
  const router = Router();

  const validate =
    (schema: typeof registerSchema | typeof loginSchema): RequestHandler =>
    (req, _res, next) => {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        return next(new AppError(400, "Validation failed", "VALIDATION_ERROR"));
      }

      req.body = result.data;
      next();
    };

  const authenticate = createAuthMiddleware(tokenService);

  router.post("/register", validate(registerSchema), controller.register);

  router.post("/login", validate(loginSchema), controller.login);

  router.get("/me", authenticate, controller.me);

  return router;
};
