import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import type { RequestHandler } from "express";

import { env } from "../config/env.js";

export const securityMiddleware: RequestHandler[] = [
  helmet(),
  cors({
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
  }),
  compression(),
];
