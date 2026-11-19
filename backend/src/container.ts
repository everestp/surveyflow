import { pool } from "./database/pool.js";
import { env } from "./config/env.js";

import { AuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";

import { BcryptPasswordService } from "./services/password.service.js";
import { JwtTokenService } from "./services/jwt.service.js";
import { SurveyRepository } from "./modules/survey/survey.repository.js";
import { SurveyService } from "./modules/survey/survey.service.js";
import { SurveyController } from "./modules/survey/survey.controller.js";
import { createSurveyRoutes } from "./modules/survey/survey.routes.js";

const surveyRepository = new SurveyRepository(pool);

const surveyService = new SurveyService(surveyRepository);

const surveyController = new SurveyController(surveyService);

// Infrastructure implementations
const authRepository = new AuthRepository(pool);
const passwordService = new BcryptPasswordService();

const tokenService = new JwtTokenService(
  env.JWT_SECRET,
  "surveyflow-api",
  "surveyflow-client",
);

// Business layer
const authService = new AuthService(
  authRepository,
  passwordService,
  tokenService,
);

// HTTP layer
const authController = new AuthController(authService);
export const surveyRoutes = createSurveyRoutes(surveyController, tokenService);
// Routes
export const authRoutes = createAuthRoutes(authController, tokenService);
import { ResponseRepository } from "./modules/response/response.repository.js";
import { ResponseService } from "./modules/response/response.service.js";
import { ResponseController } from "./modules/response/response.controller.js";
import { createResponseRoutes } from "./modules/response/response.routes.js";
import { SurveyRepository } from "./modules/survey/survey.repository.js";

const responseRepository = new ResponseRepository(pool);
const responseSurveyRepository = new SurveyRepository(pool);

const responseService = new ResponseService(
  responseRepository,
  responseSurveyRepository,
);

const responseController = new ResponseController(responseService);

export const responseRoutes = createResponseRoutes(
  responseController,
  tokenService,
);
