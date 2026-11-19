
import { pool } from "./database/pool.js";
import { env } from "./config/env.js";

// Infrastructure
import { BcryptPasswordService } from "./services/password.service.js";
import { JwtTokenService } from "./services/jwt.service.js";

// Auth module
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";

// Survey module
import { SurveyRepository } from "./modules/survey/survey.repository.js";
import { SurveyService } from "./modules/survey/survey.service.js";
import { SurveyController } from "./modules/survey/survey.controller.js";
import { createSurveyRoutes } from "./modules/survey/survey.routes.js";

// Response module
import { ResponseRepository } from "./modules/response/response.repository.js";
import { ResponseService } from "./modules/response/response.service.js";
import { ResponseController } from "./modules/response/response.controller.js";
import { createResponseRoutes } from "./modules/response/response.routes.js";

// Analytics module
import { AnalyticsRepository } from "./modules/analytics/analytics.repository.js";
import { AnalyticsService } from "./modules/analytics/analytics.service.js";
import { AnalyticsController } from "./modules/analytics/analytics.controller.js";
import { createAnalyticsRoutes } from "./modules/analytics/analytics.routes.js";

// ─────────────────────────────────────────────
// Shared infrastructure
// ─────────────────────────────────────────────

const passwordService = new BcryptPasswordService();

const tokenService = new JwtTokenService(
  env.JWT_SECRET,
  "surveyflow-api",
  "surveyflow-client",
);

// ─────────────────────────────────────────────
// Survey module
// ─────────────────────────────────────────────

const surveyRepository = new SurveyRepository(pool);

const surveyService = new SurveyService(surveyRepository);

const surveyController = new SurveyController(surveyService);

export const surveyRoutes = createSurveyRoutes(
  surveyController,
  tokenService,
);

// ─────────────────────────────────────────────
// Auth module
// ─────────────────────────────────────────────

const authRepository = new AuthRepository(pool);

const authService = new AuthService(
  authRepository,
  passwordService,
  tokenService,
);

const authController = new AuthController(authService);

export const authRoutes = createAuthRoutes(
  authController,
  tokenService,
);

// ─────────────────────────────────────────────
// Response module
// ─────────────────────────────────────────────

const responseRepository = new ResponseRepository(pool);

const responseService = new ResponseService(
  responseRepository,
  surveyRepository,
);

const responseController = new ResponseController(responseService);

export const responseRoutes = createResponseRoutes(
  responseController,
  tokenService,
);

// ─────────────────────────────────────────────
// Analytics module
// ─────────────────────────────────────────────

const analyticsRepository = new AnalyticsRepository(pool);

const analyticsService = new AnalyticsService(analyticsRepository);

const analyticsController = new AnalyticsController(analyticsService);

export const analyticsRoutes = createAnalyticsRoutes(
  analyticsController,
  tokenService,
);
