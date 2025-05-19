import express from "express"
import { authenticate, checkQuota } from "../middleware/authMiddleware"
import {
  getDeepSeekResponse,
  streamDeepSeekResponse,
  getDeepSeekVisionResponse,
  getDeepSeekCodeCompletion,
  getDeepSeekMathSolution,
  getAvailableModels,
} from "../services/deepseekService"
import { getOpenAIResponse, streamOpenAIResponse } from "../services/openaiService"
import { mergeResponses, streamMergedResponses } from "../utils/responseUtils"
import { validateRequest } from "../middleware/validateRequest"
import { logger } from "../utils/logger"
import { cache } from "../utils/cache"
import { Conversation } from "../models/conversation"
import mongoose from "mongoose"

export const askRouter = express.Router()

// Get available models
askRouter.get("/models", authenticate, async (req, res) => {
  try {
    const models = getAvailableModels()
    res.json(models)
  } catch (error) {
    logger.error("Get models error:", error)
    res.status(500).json({ error: "Failed to get models" })
  }
})

// Regular (non-streaming) chat endpoint
askRouter.post("/chat", authenticate, checkQuota, validateRequest, async (req, res, next) => {
  try {
    const { prompt, context, modelPreference, temperature, maxTokens, sessionId, functions, function_call } = req.body
    const userId = req.user.userId

    // Check cache first
    const cacheKey = `${prompt}-${JSON.stringify(context || {})}-${temperature}-${maxTokens}-${modelPreference}`
    const cachedResponse = cache.get(cacheKey)

    if (cachedResponse) {
      logger.info("Returning cached response")

      // Save to conversation history if sessionId is provided
      if (sessionId) {
        await saveToConversationHistory(userId, sessionId, prompt, cachedResponse.response, cachedResponse.modelUsed)
      }

      return res.json({ ...cachedResponse, cached: true })
    }

    // Set up options
    const options = {
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 4000,
      functions,
      function_call,
      userId: new mongoose.Types.ObjectId(userId),
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
    } else if (modelPreference && modelPreference.startsWith("deepseek")) {
      const deepseekResponse = await getDeepSeekResponse(prompt, context, options)
      response = {
        response: deepseekResponse,
        modelUsed: modelPreference,
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
    cache.set(cacheKey, response)

    // Save to conversation history if sessionId is provided
    if (sessionId) {
      await saveToConversationHistory(userId, sessionId, prompt, response.response, response.modelUsed)
    }

    res.json(response)
  } catch (error) {
    next(error)
  }
})

// Streaming chat endpoint
askRouter.post("/chat/stream", authenticate, checkQuota, validateRequest, async (req, res, next) => {
  try {
    const { prompt, context, modelPreference, temperature, maxTokens, sessionId, functions, function_call } = req.body
    const userId = req.user.userId

    // Set up options
    const options = {
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 4000,
      functions,
      function_call,
      userId: new mongoose.Types.ObjectId(userId),
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    // Initialize variables to collect the full response
    const fullResponse = ""
    const modelUsed = modelPreference || "hybrid"

    // Determine which model(s) to use
    if (modelPreference === "openai") {
      await streamOpenAIResponse(prompt, context, options, res)
    } else if (modelPreference && modelPreference.startsWith("deepseek")) {
      await streamDeepSeekResponse(prompt, context, options, res)
    } else {
      // Default: hybrid approach with merged streaming
      await streamMergedResponses(prompt, context, options, res)
    }

    // Save to conversation history if sessionId is provided
    // We'll do this asynchronously after the stream ends
    if (sessionId) {
      // The full response has been collected during streaming
      // Now save it to the conversation history
      await saveToConversationHistory(userId, sessionId, prompt, fullResponse, modelUsed)
    }

    // End the response
    res.end()
  } catch (error) {
    next(error)
  }
})

// Vision API endpoint
askRouter.post("/vision", authenticate, checkQuota, async (req, res, next) => {
  try {
    const { prompt, imageUrl, temperature, maxTokens, sessionId } = req.body
    const userId = req.user.userId

    if (!prompt || !imageUrl) {
      return res.status(400).json({ error: "Prompt and imageUrl are required" })
    }

    // Set up options
    const options = {
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 4000,
      userId: new mongoose.Types.ObjectId(userId),
    }

    // Start timer for performance tracking
    const startTime = Date.now()

    // Call DeepSeek Vision API
    const response = await getDeepSeekVisionResponse(prompt, imageUrl, options)

    const result = {
      response,
      modelUsed: "deepseek-vl",
      processingTime: Date.now() - startTime,
    }

    // Save to conversation history if sessionId is provided
    if (sessionId) {
      await saveToConversationHistory(
        userId,
        sessionId,
        `[Vision] ${prompt} [Image: ${imageUrl}]`,
        response,
        "deepseek-vl",
      )
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// Code completion endpoint
askRouter.post("/code", authenticate, checkQuota, async (req, res, next) => {
  try {
    const { code, language, temperature, maxTokens, sessionId } = req.body
    const userId = req.user.userId

    if (!code || !language) {
      return res.status(400).json({ error: "Code and language are required" })
    }

    // Set up options
    const options = {
      temperature: temperature || 0.2,
      maxTokens: maxTokens || 1024,
      userId: new mongoose.Types.ObjectId(userId),
    }

    // Start timer for performance tracking
    const startTime = Date.now()

    // Call DeepSeek Code API
    const response = await getDeepSeekCodeCompletion(code, language, options)

    const result = {
      response,
      modelUsed: "deepseek-coder-v2",
      processingTime: Date.now() - startTime,
    }

    // Save to conversation history if sessionId is provided
    if (sessionId) {
      await saveToConversationHistory(
        userId,
        sessionId,
        `[Code: ${language}] ${code.substring(0, 100)}...`,
        response,
        "deepseek-coder-v2",
      )
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// Math problem solving endpoint
askRouter.post("/math", authenticate, checkQuota, async (req, res, next) => {
  try {
    const { problem, temperature, maxTokens, sessionId } = req.body
    const userId = req.user.userId

    if (!problem) {
      return res.status(400).json({ error: "Math problem is required" })
    }

    // Set up options
    const options = {
      temperature: temperature || 0.3,
      maxTokens: maxTokens || 4000,
      userId: new mongoose.Types.ObjectId(userId),
    }

    // Start timer for performance tracking
    const startTime = Date.now()

    // Call DeepSeek Math API
    const response = await getDeepSeekMathSolution(problem, options)

    const result = {
      response,
      modelUsed: "deepseek-math",
      processingTime: Date.now() - startTime,
    }

    // Save to conversation history if sessionId is provided
    if (sessionId) {
      await saveToConversationHistory(userId, sessionId, `[Math] ${problem}`, response, "deepseek-math")
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
})

// Helper function to save to conversation history
async function saveToConversationHistory(
  userId: string,
  sessionId: string,
  userMessage: string,
  aiResponse: string,
  modelUsed: string,
): Promise<void> {
  try {
    let conversation = await Conversation.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      sessionId,
    })

    if (!conversation) {
      conversation = new Conversation({
        userId: new mongoose.Types.ObjectId(userId),
        sessionId,
        messages: [],
      })
    }

    // Add user message
    conversation.messages.push({
      content: userMessage,
      role: "user",
      timestamp: new Date(),
    })

    // Add AI response
    conversation.messages.push({
      content: aiResponse,
      role: "assistant",
      modelUsed,
      timestamp: new Date(),
    })

    await conversation.save()
  } catch (error) {
    logger.error("Error saving to conversation history:", error)
  }
}

export default askRouter
