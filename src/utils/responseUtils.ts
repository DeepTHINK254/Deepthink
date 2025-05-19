import type { Response } from "express"
import { streamOpenAIResponse } from "../services/openaiService"
import { streamDeepSeekResponse } from "../services/deepseekService"
import { logger } from "./logger"

// Merge non-streaming responses
export const mergeResponses = (openaiResponse: string, deepseekResponse: string): string => {
  if (!openaiResponse && !deepseekResponse) {
    return "No response from either model."
  }

  if (!openaiResponse) return deepseekResponse
  if (!deepseekResponse) return openaiResponse

  // Analyze responses for quality (this could be enhanced with more sophisticated logic)
  const openaiLength = openaiResponse.length
  const deepseekLength = deepseekResponse.length

  // If one response is significantly longer, it might be more detailed
  if (openaiLength > deepseekLength * 1.5) {
    return `${openaiResponse}\n\n(DeepSeek provided a shorter response that was not included)`
  }

  if (deepseekLength > openaiLength * 1.5) {
    return `${deepseekResponse}\n\n(OpenAI provided a shorter response that was not included)`
  }

  // Default: combine both responses
  return `
## OpenAI Response
${openaiResponse}

## DeepSeek Response
${deepseekResponse}

## Combined Analysis
Both models have provided insights on this topic. Consider the strengths of each approach when forming your conclusion.
`
}

// Stream merged responses
export const streamMergedResponses = async (
  prompt: string,
  context?: Record<string, any>,
  options?: { temperature?: number; maxTokens?: number },
  res?: Response,
): Promise<void> => {
  if (!res) return

  // Set up tracking for both streams
  let openaiDone = false
  let deepseekDone = false
  let openaiBuffer = ""
  let deepseekBuffer = ""

  // Send header to indicate we're starting both models
  res.write(
    `data: ${JSON.stringify({
      content: "Starting both models in parallel...\n\n",
      model: "system",
    })}\n\n`,
  )

  // Start OpenAI stream
  try {
    const openaiStream = await streamOpenAIResponse(prompt, context, options)
    // Handle OpenAI stream
    openaiStream.on("data", (chunk: any) => {
      try {
        const jsonData = JSON.parse(chunk.toString().replace("data: ", ""))
        const content = jsonData.choices[0]?.delta?.content || ""
        if (content) {
          openaiBuffer += content
          res.write(
            `data: ${JSON.stringify({
              content,
              model: "openai",
              buffer: openaiBuffer,
            })}\n\n`,
          )
        }
      } catch (e) {
        // Skip invalid JSON
      }
    })

    openaiStream.on("end", () => {
      openaiDone = true
      checkBothDone()
    })

    openaiStream.on("error", (error) => {
      logger.error(`OpenAI stream error: ${error.message}`)
      openaiDone = true
      checkBothDone()
    })
  } catch (error: any) {
    logger.error(`Failed to start OpenAI stream: ${error.message}`)
    openaiDone = true
    checkBothDone()
  }

  // Start DeepSeek stream
  try {
    const deepseekStream = await streamDeepSeekResponse(prompt, context, options)
    // Handle DeepSeek stream
    deepseekStream.on("data", (chunk: any) => {
      try {
        const jsonData = JSON.parse(chunk.toString().replace("data: ", ""))
        const content = jsonData.choices[0]?.delta?.content || ""
        if (content) {
          deepseekBuffer += content
          res.write(
            `data: ${JSON.stringify({
              content,
              model: "deepseek",
              buffer: deepseekBuffer,
            })}\n\n`,
          )
        }
      } catch (e) {
        // Skip invalid JSON
      }
    })

    deepseekStream.on("end", () => {
      deepseekDone = true
      checkBothDone()
    })

    deepseekStream.on("error", (error) => {
      logger.error(`DeepSeek stream error: ${error.message}`)
      deepseekDone = true
      checkBothDone()
    })
  } catch (error: any) {
    logger.error(`Failed to start DeepSeek stream: ${error.message}`)
    deepseekDone = true
    checkBothDone()
  }

  // Check if both streams are done and send final merged response
  function checkBothDone() {
    if (openaiDone && deepseekDone) {
      const mergedResponse = mergeResponses(openaiBuffer, deepseekBuffer)
      res.write(
        `data: ${JSON.stringify({
          content: "\n\n## Final Merged Response\n" + mergedResponse,
          model: "merged",
          final: true,
        })}\n\n`,
      )
      res.end()
    }
  }
}
