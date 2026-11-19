import { pool } from "./database/pool.js";
import { env } from "./config/env.js";

import { AuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";

import { BcryptPasswordService } from "./services/password.service.js";
import { JwtTokenService } from "./services/jwt.service.js";

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

// Routes
export const authRoutes = createAuthRoutes(authController, tokenService);
