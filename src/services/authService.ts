import jwt from "jsonwebtoken"
import { User, type IUser } from "../models/user"
import { logger } from "../utils/logger"

// JWT Secret should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key"
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h"
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key"
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d"

export interface AuthTokens {
  token: string
  refreshToken: string
  expiresIn: number
}

export interface TokenPayload {
  userId: string
  role: string
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ user: Omit<IUser, "password">; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] })
    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error("User with this email already exists")
      }
      throw new Error("User with this username already exists")
    }

    // Create user
    const user = new User({
      username,
      email,
      password, // Will be hashed by pre-save hook
    })

    await user.save()

    // Generate tokens
    const tokens = this.generateTokens(user)

    // Remove password from returned user
    const userObject = user.toObject()
    delete userObject.password

    return { user: userObject, tokens }
  }

  /**
   * Login a user
   */
  async login(email: string, password: string): Promise<{ user: Omit<IUser, "password">; tokens: AuthTokens }> {
    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      throw new Error("Invalid credentials")
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      throw new Error("Invalid credentials")
    }

    // Generate tokens
    const tokens = this.generateTokens(user)

    // Remove password from returned user
    const userObject = user.toObject()
    delete userObject.password

    return { user: userObject, tokens }
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload

      // Get user
      const user = await User.findById(payload.userId)
      if (!user) {
        throw new Error("User not found")
      }

      // Generate new tokens
      return this.generateTokens(user)
    } catch (error) {
      logger.error("Error refreshing tokens:", error)
      throw new Error("Invalid refresh token")
    }
  }

  /**
   * Verify a JWT token
   */
  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload
    } catch (error) {
      logger.error("Error verifying token:", error)
      throw new Error("Invalid token")
    }
  }

  /**
   * Generate auth tokens for a user
   */
  private generateTokens(user: IUser): AuthTokens {
    // Create token payload
    const payload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
    }

    // Calculate expiry time in seconds
    const expiresInSeconds =
      Number.parseInt((JWT_EXPIRES_IN.match(/(\d+)h?/) || [])[1], 10) * (JWT_EXPIRES_IN.includes("h") ? 3600 : 1)

    // Generate tokens
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN })

    return {
      token,
      refreshToken,
      expiresIn: expiresInSeconds,
    }
  }

  /**
   * Verify an API key
   */
  async verifyApiKey(apiKey: string): Promise<Omit<IUser, "password"> | null> {
    const user = await User.findOne({ apiKey })
    if (!user) return null

    const userObject = user.toObject()
    delete userObject.password
    return userObject
  }

  /**
   * Generate a new API key for a user
   */
  async regenerateApiKey(userId: string): Promise<string | null> {
    const user = await User.findById(userId)
    if (!user) return null

    const apiKey = user.generateApiKey()
    await user.save()

    return apiKey
  }
}

// Helper function to verify token (for middleware)
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}

// Export singleton instance
export const authService = new AuthService()
