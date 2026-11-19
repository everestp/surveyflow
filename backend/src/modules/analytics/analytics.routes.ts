import { Router, type RequestHandler } from "express";

import type { AnalyticsController } from "./analytics.controller.js";
import type { ITokenService } from "../auth/auth.interfaces.js";

import { createAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { AppError } from "../../utils/app-error.js";

import { trendQuerySchema } from "./analytics.validation.js";

export const createAnalyticsRoutes = (
  controller: AnalyticsController,
  tokenService: ITokenService,
): Router => {
  const router = Router();

  const authenticate = createAuthMiddleware(tokenService);

  const validateTrendQuery: RequestHandler = (req, _res, next) => {
    const result = trendQuerySchema.safeParse(req.query);

    if (!result.success) {
      return next(new AppError(400, "Invalid trend query", "VALIDATION_ERROR"));
    }

    Object.defineProperty(req, "validatedQuery", {
      value: result.data,
      configurable: true,
    });

    next();
  };

  router.use(authenticate);

  router.get("/overview", controller.getOverview);
  router.get(
    "/responses/trend",
    validateTrendQuery,
    controller.getResponseTrend,
  );
  router.get("/surveys/:surveyId", controller.getSurveyAnalytics);

  return router;
};
