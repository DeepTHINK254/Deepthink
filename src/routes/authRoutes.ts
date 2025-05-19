import express from "express"
import { authService } from "../services/authService"
import { User } from "../models/user"
import { authenticate, authorize } from "../middleware/authMiddleware"
import { logger } from "../utils/logger"

export const authRouter = express.Router()

// Register a new user
authRouter.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" })
    }

    // Register user
    const { user, tokens } = await authService.register(username, email, password)

    res.status(201).json({ user, ...tokens })
  } catch (error: any) {
    logger.error("Registration error:", error)
    if (error.message.includes("already exists")) {
      return res.status(409).json({ error: error.message })
    }
    next(error)
  }
})

// Login
authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    // Login user
    const { user, tokens } = await authService.login(email, password)

    res.json({ user, ...tokens })
  } catch (error: any) {
    logger.error("Login error:", error)
    if (error.message === "Invalid credentials") {
      return res.status(401).json({ error: "Invalid credentials" })
    }
    next(error)
  }
})

// Refresh tokens
authRouter.post("/refresh-token", async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" })
    }

    const tokens = await authService.refreshTokens(refreshToken)
    res.json(tokens)
  } catch (error: any) {
    logger.error("Token refresh error:", error)
    if (error.message === "Invalid refresh token") {
      return res.status(401).json({ error: "Invalid refresh token" })
    }
    next(error)
  }
})

// Get current user
authRouter.get("/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await User.findById(userId).select("-password")

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(user)
  } catch (error) {
    logger.error("Get current user error:", error)
    res.status(500).json({ error: "Failed to get user information" })
  }
})

// Generate new API key
authRouter.post("/api-key", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId
    const apiKey = await authService.regenerateApiKey(userId)

    if (!apiKey) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({ apiKey })
  } catch (error) {
    logger.error("API key generation error:", error)
    res.status(500).json({ error: "Failed to generate API key" })
  }
})

// Update user preferences
authRouter.put("/preferences", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId
    const { defaultModel, theme, language } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Update preferences
    if (defaultModel) user.preferences.defaultModel = defaultModel
    if (theme) user.preferences.theme = theme
    if (language) user.preferences.language = language

    await user.save()

    res.json({ preferences: user.preferences })
  } catch (error) {
    logger.error("Update preferences error:", error)
    res.status(500).json({ error: "Failed to update preferences" })
  }
})

// Admin only: List all users
authRouter.get("/users", authenticate, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password")
    res.json(users)
  } catch (error) {
    logger.error("List users error:", error)
    res.status(500).json({ error: "Failed to list users" })
  }
})

// Admin only: Update user quota
authRouter.put("/users/:userId/quota", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { userId } = req.params
    const { monthly } = req.body

    if (!monthly || typeof monthly !== "number" || monthly < 0) {
      return res.status(400).json({ error: "Valid monthly quota is required" })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    user.usageQuota.monthly = monthly
    await user.save()

    res.json({ usageQuota: user.usageQuota })
  } catch (error) {
    logger.error("Update quota error:", error)
    res.status(500).json({ error: "Failed to update quota" })
  }
})

export default authRouter
