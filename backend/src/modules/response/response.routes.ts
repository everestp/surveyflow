import { Router, type RequestHandler } from "express";

import type { ResponseController } from "./response.controller.js";
import type { ITokenService } from "../auth/auth.interfaces.js";

import { createAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/api-error.js";

import {
  submitResponseSchema,
  responseListQuerySchema,
} from "./response.validation.js";

export const createResponseRoutes = (
  controller: ResponseController,
  tokenService: ITokenService,
): Router => {
  const router = Router();

  const validateBody: RequestHandler = (req, _res, next) => {
    const result = submitResponseSchema.safeParse(req.body);

    if (!result.success) {
      return next(new AppError(400, "Validation failed", "VALIDATION_ERROR"));
    }

    req.body = result.data;
    next();
  };

  const validateQuery: RequestHandler = (req, _res, next) => {
    const result = responseListQuerySchema.safeParse(req.query);

    if (!result.success) {
      return next(
        new AppError(400, "Invalid query parameters", "VALIDATION_ERROR"),
      );
    }

    Object.defineProperty(req, "validatedQuery", {
      value: result.data,
      configurable: true,
    });

    next();
  };

  const authenticate = createAuthMiddleware(tokenService);

  // Public survey submission endpoint
  router.post("/:surveyId", validateBody, controller.submit);

  // Private endpoint for survey owners
  router.get("/:surveyId", authenticate, validateQuery, controller.getBySurvey);

  return router;
};
