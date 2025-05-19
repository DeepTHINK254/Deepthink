import express from "express"
import { getOpenAIResponse, streamOpenAIResponse } from "../services/openaiService"
import { getDeepSeekResponse, streamDeepSeekResponse } from "../services/deepseekService"
import { mergeResponses, streamMergedResponses } from "../utils/responseUtils"
import { validateRequest } from "../middleware/validateRequest"
import { logger } from "../utils/logger"
import { responseCache, requestStore } from "../lib/store"

export const askRouter = express.Router()

// Regular (non-streaming) endpoint
askRouter.post("/", validateRequest, async (req, res, next) => {
  try {
    const { prompt, context, modelPreference, temperature, maxTokens } = req.body

    // Check cache first
    const cacheKey = `${prompt}-${JSON.stringify(context || {})}-${temperature}-${maxTokens}`
    const cachedResponse = responseCache.get(cacheKey)

    if (cachedResponse) {
      logger.info("Returning cached response")
      requestStore.trackRequest(true)
      return res.json({ ...cachedResponse, cached: true })
    }

    // Set up options
    const options = {
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 4000,
    }

    // Start timer for performance tracking
    const startTime = Date.now()

    // Determine which model(s) to use
    let response

    if (modelPreference === "openai") {
      const openaiResponse = await getOpenAIResponse(prompt, context, options)
      response = {
        response: openaiResponse,
        modelUsed: "openai",
        processingTime: Date.now() - startTime,
      }
    } else if (modelPreference === "deepseek") {
      const deepseekResponse = await getDeepSeekResponse(prompt, context, options)
      response = {
        response: deepseekResponse,
        modelUsed: "deepseek",
        processingTime: Date.now() - startTime,
      }
    } else {
      // Default: hybrid approach
      const [openaiResponse, deepseekResponse] = await Promise.all([
        getOpenAIResponse(prompt, context, options),
        getDeepSeekResponse(prompt, context, options),
      ])

      const mergedResponse = mergeResponses(openaiResponse, deepseekResponse)
      response = {
        response: mergedResponse,
        openaiResponse,
        deepseekResponse,
        modelUsed: "hybrid",
        processingTime: Date.now() - startTime,
      }
    }

    // Cache the response
    responseCache.set(cacheKey, response)

    // Track successful request
    requestStore.trackRequest(true)

    res.json(response)
  } catch (error) {
    // Track failed request
    requestStore.trackRequest(false)
    next(error)
  }
})

// Streaming endpoint
askRouter.post("/stream", validateRequest, async (req, res, next) => {
  try {
    const { prompt, context, modelPreference, temperature, maxTokens } = req.body

    // Set up options
    const options = {
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 4000,
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    // Determine which model(s) to use
    if (modelPreference === "openai") {
      await streamOpenAIResponse(prompt, context, options, res)
    } else if (modelPreference === "deepseek") {
      await streamDeepSeekResponse(prompt, context, options, res)
    } else {
      // Default: hybrid approach with merged streaming
      await streamMergedResponses(prompt, context, options, res)
    }

    // Track successful request
    requestStore.trackRequest(true)

    // End the response
    res.end()
  } catch (error) {
    // Track failed request
    requestStore.trackRequest(false)
    next(error)
  }
})

export default askRouter
