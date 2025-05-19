import OpenAI from "openai"
import type { Response } from "express"
import { logger } from "../utils/logger"
import { backOff } from "exponential-backoff"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Regular response
export const getOpenAIResponse = async (
  prompt: string,
  context?: Record<string, any>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> => {
  try {
    // Prepare messages
    const messages = []

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
      () =>
        openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 4000,
        }),
      {
        numOfAttempts: 3,
        startingDelay: 1000,
        timeMultiple: 2,
        retry: (e: any) => {
          logger.warn(`OpenAI API error, retrying: ${e.message}`)
          return true
        },
      },
    )

    return response.choices[0].message.content || ""
  } catch (error: any) {
    logger.error(`OpenAI API error: ${error.message}`)
    throw new Error(`OpenAI API error: ${error.message}`)
  }
}

// Streaming response
export const streamOpenAIResponse = async (
  prompt: string,
  context?: Record<string, any>,
  options?: { temperature?: number; maxTokens?: number },
  res?: Response,
): Promise<void> => {
  try {
    // Prepare messages
    const messages = []

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

    // Create streaming completion
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 4000,
      stream: true,
    })

    // Stream the response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ""
      if (content && res) {
        res.write(`data: ${JSON.stringify({ content, model: "openai" })}\n\n`)
      }
    }
  } catch (error: any) {
    logger.error(`OpenAI streaming error: ${error.message}`)
    if (res) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    }
    throw new Error(`OpenAI streaming error: ${error.message}`)
  }
}
