import type { Request, Response, NextFunction } from "express"
import { authService } from "../services/authService"
import { User } from "../models/user"
import { logger } from "../utils/logger"

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any
    }
  }
}

/**
 * Authentication middleware using JWT
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: "Authentication required" })
    }

    // Check if it's a Bearer token
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7)
      try {
        // Verify token
        const payload = authService.verifyToken(token)

        // Get user from database to ensure it still exists
        const user = await User.findById(payload.userId)
        if (!user) {
          return res.status(401).json({ error: "User not found" })
        }

        req.user = {
          userId: payload.userId,
          role: payload.role,
          username: user.username,
          email: user.email,
        }

        return next()
      } catch (error) {
        logger.error("JWT verification failed:", error)
        return res.status(401).json({ error: "Invalid token" })
      }
    }

    // Check if it's an API key
    if (authHeader.startsWith("ApiKey ")) {
      const apiKey = authHeader.substring(7)
      const user = await authService.verifyApiKey(apiKey)
      if (user) {
        req.user = {
          userId: user._id,
          role: user.role,
          username: user.username,
          email: user.email,
        }
        return next()
      } else {
        return res.status(401).json({ error: "Invalid API key" })
      }
    }

    return res.status(401).json({ error: "Invalid authorization format" })
  } catch (error) {
    logger.error("Auth middleware error:", error)
    return res.status(500).json({ error: "Authentication error" })
  }
}

/**
 * Authorization middleware for role-based access control
 */
export const authorize = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user exists in request
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" })
      }

      // Convert roles to array if it's a string
      const allowedRoles = Array.isArray(roles) ? roles : [roles]

      // Check if user role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" })
      }

      next()
    } catch (error) {
      logger.error("Authorization middleware error:", error)
      return res.status(500).json({ error: "Authorization error" })
    }
  }
}

/**
 * Quota check middleware
 */
export const checkQuota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const user = await User.findById(req.user.userId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Check if quota reset date has passed
    const now = new Date()
    if (now > user.usageQuota.resetDate) {
      // Reset quota
      user.usageQuota.used = 0
      user.usageQuota.resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      await user.save()
    }

    // Check if user has exceeded quota
    if (user.usageQuota.used >= user.usageQuota.monthly) {
      return res.status(403).json({ error: "Monthly usage quota exceeded" })
    }

    next()
  } catch (error) {
    logger.error("Quota check middleware error:", error)
    return res.status(500).json({ error: "Quota check error" })
  }
}
