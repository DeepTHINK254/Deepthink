import winston from "winston"

// Configure logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: "deepthink-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
})

// Add file transport in production
if (process.env.NODE_ENV === "production") {
  logger.add(new winston.transports.File({ filename: "logs/error.log", level: "error" }))
  logger.add(new winston.transports.File({ filename: "logs/combined.log" }))
}
