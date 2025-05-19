import axios from "axios"
import type { Response } from "express"
import { logger } from "../utils/logger"
import { backOff } from "exponential-backoff"
import { ApiUsage } from "../models/apiUsage"
import mongoose from "mongoose"

// Define DeepSeek model types
export type DeepSeekModel =
  | "deepseek-v3"
  | "deepseek-r1"
  | "deepseek-coder-v2"
  | "deepseek-vl"
  | "deepseek-v2"
  | "deepseek-coder"
  | "deepseek-math"
  | "deepseek-llm"

// Define model capabilities
interface ModelCapability {
  maxTokens: number
  supportsFunctions: boolean
  supportsVision: boolean
  supportsStreaming: boolean
  costPerToken: number // in USD per 1000 tokens
}

// Model capabilities map
const MODEL_CAPABILITIES: Record<DeepSeekModel, ModelCapability> = {
  "deepseek-v3": {
    maxTokens: 8192,
    supportsFunctions: true,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.0005,
  },
  "deepseek-r1": {
    maxTokens: 16384,
    supportsFunctions: true,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.001,
  },
  "deepseek-coder-v2": {
    maxTokens: 16384,
    supportsFunctions: true,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.0008,
  },
  "deepseek-vl": {
    maxTokens: 4096,
    supportsFunctions: false,
    supportsVision: true,
    supportsStreaming: true,
    costPerToken: 0.0015,
  },
  "deepseek-v2": {
    maxTokens: 4096,
    supportsFunctions: false,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.0003,
  },
  "deepseek-coder": {
    maxTokens: 8192,
    supportsFunctions: true,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.0006,
  },
  "deepseek-math": {
    maxTokens: 8192,
    supportsFunctions: false,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.0007,
  },
  "deepseek-llm": {
    maxTokens: 4096,
    supportsFunctions: false,
    supportsVision: false,
    supportsStreaming: true,
    costPerToken: 0.0002,
  },
}

// Message interface
interface Message {
  role: "system" | "user" | "assistant" | "function"
  content: string | null
  name?: string
  function_call?: {
    name: string
    arguments: string
  }
}

// Function definition interface
interface FunctionDefinition {
  name: string
  description: string
  parameters: Record<string, any>
}

// Request options interface
interface RequestOptions {
  temperature?: number
  maxTokens?: number
  functions?: FunctionDefinition[]
  function_call?: "auto" | "none" | { name: string }
  userId?: mongoose.Types.ObjectId
}

// Track token usage
const trackUsage = async (
  userId: mongoose.Types.ObjectId,
  model: DeepSeekModel,
  tokensUsed: number,
  endpoint: string,
): Promise<void> => {
  if (!userId) return

  try {
    const cost = (tokensUsed / 1000) * MODEL_CAPABILITIES[model].costPerToken

    await ApiUsage.create({
      userId,
      endpoint,
      model,
      tokensUsed,
      cost,
      timestamp: new Date(),
    })

    // Update user's usage quota
    await mongoose.model("User").updateOne(
      { _id: userId },
      {
        $inc: { "usageQuota.used": tokensUsed },
      },
    )
  } catch (error) {
    logger.error("Failed to track API usage:", error)
  }
}

// Regular response
export const getDeepSeekResponse = async (
  prompt: string,
  context?: Record<string, any>,
  options?: RequestOptions,
): Promise<string> => {
  try {
    // Determine which model to use
    const model = (options?.functions ? "deepseek-r1" : "deepseek-v3") as DeepSeekModel

    // Prepare messages
    const messages: Message[] = []

    // Add system message if context is provided
    if (context) {
      messages.push({
        role: "system",
        content: `Context: ${JSON.stringify(context)}`,
      })
    }

    // Add user message
    messages.push({
      role: "user",
      content: prompt,
    })

    // Use backoff for retries
    const response = await backOff(
      async () => {
        const res = await axios.post(
          "https://api.deepseek.com/v1/chat/completions",
          {
            model,
            messages,
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || MODEL_CAPABILITIES[model].maxTokens,
            ...(options?.functions && {
              functions: options.functions,
              function_call: options.function_call || "auto",
            }),
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 30000, // 30 seconds timeout
          },
        )
        return res.data
      },
      {
        numOfAttempts: 3,
        startingDelay: 1000,
        timeMultiple: 2,
        retry: (e: any) => {
          logger.warn(`DeepSeek API error, retrying: ${e.message}`)
          return true
        },
      },
    )

    // Track usage if userId is provided
    if (options?.userId) {
      const tokensUsed = response.usage.total_tokens || 0
      await trackUsage(options.userId, model, tokensUsed, "chat/completions")
    }

    // Handle function calls
    if (response.choices[0].message.function_call) {
      return JSON.stringify(response.choices[0].message.function_call)
    }

    return response.choices[0].message.content || ""
  } catch (error: any) {
    logger.error(`DeepSeek API error: ${error.message}`)
    throw new Error(`DeepSeek API error: ${error.message}`)
  }
}

// Streaming response
export const streamDeepSeekResponse = async (
  prompt: string,
  context?: Record<string, any>,
  options?: RequestOptions,
  res?: Response,
): Promise<void> => {
  try {
    // Determine which model to use
    const model = (options?.functions ? "deepseek-r1" : "deepseek-v3") as DeepSeekModel

    // Prepare messages
    const messages: Message[] = []

    // Add system message if context is provided
    if (context) {
      messages.push({
        role: "system",
        content: `Context: ${JSON.stringify(context)}`,
      })
    }

    // Add user message
    messages.push({
      role: "user",
      content: prompt,
    })

    // Create streaming request
    const response = await axios({
      method: "post",
      url: "https://api.deepseek.com/v1/chat/completions",
      data: {
        model,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || MODEL_CAPABILITIES[model].maxTokens,
        stream: true,
        ...(options?.functions && {
          functions: options.functions,
          function_call: options.function_call || "auto",
        }),
      },
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      responseType: "stream",
    })

    let totalTokens = 0

    // Stream the response
    response.data.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n\n")
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const jsonData = JSON.parse(line.replace("data: ", ""))
            const content = jsonData.choices[0]?.delta?.content || ""
            const functionCall = jsonData.choices[0]?.delta?.function_call

            // Count tokens for usage tracking
            if (content) totalTokens += 1

            if (content && res) {
              res.write(`data: ${JSON.stringify({ content, model })}\n\n`)
            }

            if (functionCall && res) {
              res.write(`data: ${JSON.stringify({ function_call: functionCall, model })}\n\n`)
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    })

    // Handle end of stream
    await new Promise<void>((resolve, reject) => {
      response.data.on("end", async () => {
        // Track usage if userId is provided
        if (options?.userId) {
          await trackUsage(options.userId, model, totalTokens, "chat/completions/stream")
        }
        resolve()
      })
      response.data.on("error", reject)
    })
  } catch (error: any) {
    logger.error(`DeepSeek streaming error: ${error.message}`)
    if (res) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    }
    throw new Error(`DeepSeek streaming error: ${error.message}`)
  }
}

// Vision API for image understanding
export const getDeepSeekVisionResponse = async (
  prompt: string,
  imageUrl: string,
  options?: RequestOptions,
): Promise<string> => {
  try {
    const model = "deepseek-vl" as DeepSeekModel

    // Prepare messages with image content
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ]

    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || MODEL_CAPABILITIES[model].maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    )

    // Track usage if userId is provided
    if (options?.userId) {
      const tokensUsed = response.data.usage.total_tokens || 0
      await trackUsage(options.userId, model, tokensUsed, "vision")
    }

    return response.data.choices[0].message.content || ""
  } catch (error: any) {
    logger.error(`DeepSeek Vision API error: ${error.message}`)
    throw new Error(`DeepSeek Vision API error: ${error.message}`)
  }
}

// Code completion API
export const getDeepSeekCodeCompletion = async (
  code: string,
  language: string,
  options?: RequestOptions,
): Promise<string> => {
  try {
    const model = "deepseek-coder-v2" as DeepSeekModel

    const response = await axios.post(
      "https://api.deepseek.com/v1/completions",
      {
        model,
        prompt: `Language: ${language}\n\nCode:\n${code}\n\nContinue the code:`,
        temperature: options?.temperature || 0.2,
        max_tokens: options?.maxTokens || 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    )

    // Track usage if userId is provided
    if (options?.userId) {
      const tokensUsed = response.data.usage.total_tokens || 0
      await trackUsage(options.userId, model, tokensUsed, "code-completion")
    }

    return response.data.choices[0].text || ""
  } catch (error: any) {
    logger.error(`DeepSeek Code API error: ${error.message}`)
    throw new Error(`DeepSeek Code API error: ${error.message}`)
  }
}

// Math problem solving API
export const getDeepSeekMathSolution = async (problem: string, options?: RequestOptions): Promise<string> => {
  try {
    const model = "deepseek-math" as DeepSeekModel

    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model,
        messages: [
          {
            role: "system",
            content: "You are a math expert. Solve the following problem step by step.",
          },
          {
            role: "user",
            content: problem,
          },
        ],
        temperature: options?.temperature || 0.3,
        max_tokens: options?.maxTokens || MODEL_CAPABILITIES[model].maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    )

    // Track usage if userId is provided
    if (options?.userId) {
      const tokensUsed = response.data.usage.total_tokens || 0
      await trackUsage(options.userId, model, tokensUsed, "math")
    }

    return response.data.choices[0].message.content || ""
  } catch (error: any) {
    logger.error(`DeepSeek Math API error: ${error.message}`)
    throw new Error(`DeepSeek Math API error: ${error.message}`)
  }
}

// Get available models
export const getAvailableModels = (): { id: DeepSeekModel; capabilities: ModelCapability }[] => {
  return Object.entries(MODEL_CAPABILITIES).map(([id, capabilities]) => ({
    id: id as DeepSeekModel,
    capabilities,
  }))
}
