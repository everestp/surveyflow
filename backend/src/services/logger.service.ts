import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "node:path";
import { getCorrelationId } from "../utils/helpers/request.helpers.js";

const logDirectory = path.resolve(process.cwd(), "src/logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",

  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({
      format: "MM-DD-YYYY HH:mm:ss",
    }),
    winston.format.printf(({ level, message, timestamp, ...data }) => {
      const output = {
        level,
        message,
        timestamp,
        correlationId: getCorrelationId(),
        data,
      };

      return JSON.stringify(output);
    }),
  ),

  transports: [
    new winston.transports.Console(),

    new DailyRotateFile({
      dirname: logDirectory,
      filename: "%DATE%-app.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

export default logger;
