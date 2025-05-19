import type { Request, Response, NextFunction } from "express"

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const { prompt } = req.body

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "A valid prompt is required" })
  }

  // Validate optional parameters
  const { temperature, maxTokens, modelPreference } = req.body

  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0 || temperature > 2)) {
    return res.status(400).json({ error: "Temperature must be a number between 0 and 2" })
  }

  if (maxTokens !== undefined && (typeof maxTokens !== "number" || maxTokens < 1 || maxTokens > 8000)) {
    return res.status(400).json({ error: "maxTokens must be a number between 1 and 8000" })
  }

  if (modelPreference !== undefined && !["openai", "deepseek", "hybrid"].includes(modelPreference)) {
    return res.status(400).json({
      error: "modelPreference must be one of: openai, deepseek, hybrid",
    })
  }

  next()
}
