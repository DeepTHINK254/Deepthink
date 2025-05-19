import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error: ${err.message}`)

  // Authentication errors
  if (err.message.includes("Invalid token") || err.message.includes("jwt")) {
    return res.status(401).json({
      error: "Authentication failed",
      details: err.message,
    })
  }

  // Authorization errors
  if (err.message.includes("permission") || err.message.includes("not authorized")) {
    return res.status(403).json({
      error: "Insufficient permissions",
      details: err.message,
    })
  }

  // API errors
  if (err.message.includes("OpenAI API")) {
    return res.status(502).json({
      error: "Error communicating with OpenAI API",
      details: err.message,
    })
  }

  if (err.message.includes("DeepSeek API")) {
    return res.status(502).json({
      error: "Error communicating with DeepSeek API",
      details: err.message,
    })
  }

  // Default error response
  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "production" ? undefined : err.message,
  })
}
