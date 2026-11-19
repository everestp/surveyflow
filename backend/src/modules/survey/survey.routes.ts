import { Router, type RequestHandler } from "express";

import type { SurveyController } from "./survey.controller.js";
import type { ITokenService } from "../auth/auth.interfaces.js";

import { createAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";

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

  router.use(authenticate);

  router.post("/", validateBody(createSurveySchema), controller.create);
  router.get("/", validateQuery, controller.getAll);
  router.get("/:id", controller.getById);
  router.patch("/:id", validateBody(updateSurveySchema), controller.update);
  router.delete("/:id", controller.delete);
  router.patch("/:id/publish", controller.publish);

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
