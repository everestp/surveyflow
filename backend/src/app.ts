import express from "express";

import { correlationMiddleware } from "./middlewares/correlation.middleware.js";
import { securityMiddleware } from "./middlewares/security.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

import { v1Routes } from "./routes/v1.routes.js";

const app = express();

// ─────────────────────────────────────────────
// Application configuration
// ─────────────────────────────────────────────

app.disable("x-powered-by");

// ─────────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────────

app.use(correlationMiddleware);
app.use(...securityMiddleware);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "SurveyFlow API is healthy",
  });
});

// ─────────────────────────────────────────────
// API routes
// ─────────────────────────────────────────────

app.use("/api/v1", v1Routes);

// ─────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
