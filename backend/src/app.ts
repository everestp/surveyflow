import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";

import { correlationMiddleware } from "./middlewares/correlation.middleware.js";
import { securityMiddleware } from "./middlewares/security.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

import { v1Routes } from "./routes/v1.routes.js";

const app: Application = express();

// ─────────────────────────────────────────────
// Application configuration
// ─────────────────────────────────────────────

app.disable("x-powered-by");
app.set("trust proxy", 1); // Enable if behind 1 reverse proxy / load balancer

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Max 100 requests per IP per window
  standardHeaders: "draft-8", // Sends RateLimit headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

// ─────────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────────

app.use(correlationMiddleware);
app.use(...securityMiddleware);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─────────────────────────────────────────────
// Health check (kept outside rate limit)
// ─────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "SurveyFlow API is healthy",
  });
});

// ─────────────────────────────────────────────
// API routes
// ─────────────────────────────────────────────

app.use("/api/v1", apiLimiter, v1Routes);

// ─────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
