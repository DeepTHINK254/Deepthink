import express from "express"
import { getOpenAIResponse } from "../services/openaiService"
import { getDeepSeekResponse } from "../services/deepseekService"
import { logger } from "../utils/logger"
import { requestStore } from "../lib/store"

export const healthRouter = express.Router()

healthRouter.get("/", async (req, res) => {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      openai: "unknown",
      deepseek: "unknown",
    },
    auth: {
      enabled: true,
      jwtSecret: process.env.JWT_SECRET ? "configured" : "default (insecure)",
    },
    stats: requestStore.getStats(),
  }

  res.json(status)
})

// Detailed health check that tests API connections
healthRouter.get("/detailed", async (req, res) => {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      openai: "unknown",
      deepseek: "unknown",
    },
    auth: {
      enabled: true,
      jwtSecret: process.env.JWT_SECRET ? "configured" : "default (insecure)",
      jwtExpiry: process.env.JWT_EXPIRES_IN || "1h",
    },
    uptime: process.uptime(),
    stats: requestStore.getStats(),
    memory: process.memoryUsage(),
  }

  try {
    // Test OpenAI connection
    await getOpenAIResponse("Hello", undefined, { maxTokens: 5 })
    status.services.openai = "ok"
  } catch (error) {
    status.services.openai = "error"
    status.status = "degraded"
    logger.error(`OpenAI health check failed: ${error}`)
  }

  try {
    // Test DeepSeek connection
    await getDeepSeekResponse("Hello", undefined, { maxTokens: 5 })
    status.services.deepseek = "ok"
  } catch (error) {
    status.services.deepseek = "error"
    status.status = "degraded"
    logger.error(`DeepSeek health check failed: ${error}`)
  }

  // If both services are down, mark as critical
  if (status.services.openai === "error" && status.services.deepseek === "error") {
    status.status = "critical"
  }

  res.json(status)
})

// Reset stats endpoint
healthRouter.post("/reset-stats", (req, res) => {
  requestStore.resetStats()
  res.json({ message: "Stats reset successfully", stats: requestStore.getStats() })
})

export default healthRouter
