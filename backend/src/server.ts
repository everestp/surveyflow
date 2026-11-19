
import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./database/pool.js";
import logger from "./services/logger.service.js";

const startServer = async (): Promise<void> => {
  try {
    // Verify database connection before accepting requests.
    await pool.query("SELECT 1");

    logger.info("Database connection established");

    const server = app.listen(env.PORT, () => {
      logger.info("SurveyFlow API started", {
        port: env.PORT,
        environment: env.NODE_ENV,
      });
    });

    let isShuttingDown = false;

    const shutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) return;

      isShuttingDown = true;

      logger.info("Graceful shutdown initiated", { signal });

      server.close(async (error) => {
        if (error) {
          logger.error("HTTP server shutdown failed", { error });
          process.exitCode = 1;
        }

        try {
          await pool.end();
          logger.info("Database connection pool closed");
        } catch (error) {
          logger.error("Database pool shutdown failed", { error });
          process.exitCode = 1;
        }
      });
    };

    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled promise rejection", { reason });
      void shutdown("unhandledRejection");
    });

    process.on("uncaughtException", (error) => {
      logger.fatal("Uncaught exception", {
        message: error.message,
        stack: error.stack,
      });

      void shutdown("uncaughtException");
    });
  } catch (error) {
    logger.fatal("Server startup failed", { error });

    try {
      await pool.end();
    } catch (poolError) {
      logger.error("Database pool cleanup failed", {
        error: poolError,
      });
    }

    process.exitCode = 1;
  }
};

void startServer();
