import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/api-error.js";
import logger from "../services/logger.service.js";
import { getCorrelationId } from "../utils/helpers/request.helpers.js";

export const errorMiddleware: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    logger.warn("Request validation failed", {
      errors: error.issues,
    });

    res.status(400).json({
      success: false,
      message: "Validation failed",
      correlationId: getCorrelationId(),
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });

    return;
  }

  if (error instanceof AppError) {
    logger.warn("Application error", {
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      correlationId: getCorrelationId(),
    });

    return;
  }

  logger.error("Unexpected application error", {
    error: {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
    correlationId: getCorrelationId(),
  });
};
