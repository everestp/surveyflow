import logger from "./services/logger.service.js";
import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./database/pool";

const startServer = async () => {
  try {
    await pool.query("SELECT 1");

    const server = app.listen(env.PORT, () => {
      logger.info("Server started", {
        port: env.PORT,
        environment: env.NODE_ENV,
      });
    });

    server.on("error", (error) => {
      logger.error("HTTP server error", { error });
    });
  } catch (error) {
    logger.error("Server startup failed", { error });
    await pool.end();
    process.exit(1);
  }
};

void startServer();
