import { Router, type RequestHandler } from "express";

import type { SurveyController } from "./survey.controller.js";
import type { ITokenService } from "../auth/auth.interfaces.js";

import { createAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/api-error.js";

import {
  createSurveySchema,
  updateSurveySchema,
  surveyListQuerySchema,
} from "./survey.validation.js";

export const createSurveyRoutes = (
  controller: SurveyController,
  tokenService: ITokenService,
): Router => {
  const router = Router();

  const authenticate = createAuthMiddleware(tokenService);

  const optionalAuthenticate: RequestHandler = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }
    return authenticate(req, res, next);
  };

  const validateBody =
    (
      schema: typeof createSurveySchema | typeof updateSurveySchema,
    ): RequestHandler =>
    (req, _res, next) => {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        return next(new AppError(400, "Validation failed", "VALIDATION_ERROR"));
      }

      req.body = result.data;
      next();
    };

  const validateQuery: RequestHandler = (req, _res, next) => {
    const result = surveyListQuerySchema.safeParse(req.query);

    if (!result.success) {
      return next(
        new AppError(400, "Invalid query parameters", "VALIDATION_ERROR"),
      );
    }

    resAssignQuery(req, result.data);
    next();
  };

  // Authenticated user's own surveys (must come BEFORE /:id)
  router.get("/mine", authenticate, validateQuery, controller.getAllByUserId);

  // Publicly readable when published (optional auth attaches req.user if logged in)
  router.get("/", optionalAuthenticate, validateQuery, controller.getAll);
  router.get("/:id", optionalAuthenticate, controller.getById);

  // Admin-only routes
  router.post(
    "/",
    authenticate,
    validateBody(createSurveySchema),
    controller.create,
  );
  router.patch(
    "/:id",
    authenticate,
    validateBody(updateSurveySchema),
    controller.update,
  );
  router.delete("/:id", authenticate, controller.delete);
  router.patch("/:id/publish", authenticate, controller.publish);

  return router;
};

function resAssignQuery(
  req: Parameters<RequestHandler>[0],
  data: unknown,
): void {
  Object.defineProperty(req, "validatedQuery", {
    value: data,
    configurable: true,
  });
}
