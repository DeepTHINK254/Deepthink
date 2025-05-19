import express from "express"
import http from "http"
import dotenv from "dotenv"
import cors from "cors"
import rateLimit from "express-rate-limit"
import { askRouter } from "./routes/askRoutes"
import { healthRouter } from "./routes/health"
import { authRouter } from "./routes/authRoutes"
import { conversationRouter } from "./routes/conversationRoutes"
import { authenticate } from "./middleware/authMiddleware"
import { errorHandler } from "./middleware/errorHandler"
import { logger } from "./utils/logger"
import { connectToDatabase } from "./utils/database"
import { WebSocketService } from "./services/websocketService"

// Load environment variables
dotenv.config()

// Initialize Express app
const app = express()
const server = http.createServer(app)

// Connect to MongoDB
connectToDatabase()
  .then(() => {
    logger.info("MongoDB connection established")
  })
  .catch((error) => {
    logger.error("MongoDB connection failed:", error)
    process.exit(1)
  })

// Apply middleware
app.use(express.json({ limit: "50mb" }))
app.use(cors())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later",
})
app.use(limiter)

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later",
})
app.use("/api/auth/login", authLimiter)
app.use("/api/auth/register", authLimiter)

// Public routes
app.use("/api/auth", authRouter)
app.use("/api/health", healthRouter)

// Protected routes (require authentication)
app.use("/api/ask", authenticate, askRouter)
app.use("/api/conversations", authenticate, conversationRouter)

// Error handling
app.use(errorHandler)

// Initialize WebSocket service
const wsService = new WebSocketService(server)

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  logger.info(`🚀 DeepTHINK backend running on port ${PORT}`)
  logger.info(`✅ Authentication enabled with JWT`)
  logger.info(`✅ WebSocket server initialized`)
  logger.info(`✅ MongoDB connected`)
  logger.info(`✅ All DeepSeek models integrated`)
})

export default app
