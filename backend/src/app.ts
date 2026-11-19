import express from "express";
import { correlationMiddleware } from "./middlewares/correlation.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { v1Routes } from "./routes/v1.routes.js";

const app = express();

// 1. Request context must be established first.
app.use(correlationMiddleware);

// 2. Body parsing.
app.use(express.json({ limit: "1mb" }));

// 3. API routes.
app.use("/api/v1", v1Routes);

// 4. Centralized error handling must be last.
app.use(errorMiddleware);

export default app;
