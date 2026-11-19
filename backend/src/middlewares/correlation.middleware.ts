import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { asyncLocalStorage } from "../utils/helpers/request.helpers.js";
import logger from "../services/logger.service.js";

export const correlationMiddleware: RequestHandler = (req, res, next) => {
  const correlationId = randomUUID();

  asyncLocalStorage.run({ correlationId }, () => {
    res.setHeader("X-Correlation-ID", correlationId);

    const startedAt = performance.now();

    res.on("finish", () => {
      logger.info("HTTP request completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });

    next();
  });
};
