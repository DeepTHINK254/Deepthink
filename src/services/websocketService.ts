import type { Server as HttpServer } from "http"
import { WebSocketServer, WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { logger } from "../utils/logger"
import { verifyToken } from "./authService"
import { getDeepSeekResponse } from "./deepseekService"
import { getOpenAIResponse } from "./openaiService"
import { Conversation } from "../models/conversation"
import { User } from "../models/user"
import mongoose from "mongoose"

interface WebSocketClient extends WebSocket {
  id: string
  userId?: string
  sessionId?: string
  isAlive: boolean
}

interface WebSocketMessage {
  type: string
  payload: any
}

export class WebSocketService {
  private wss: WebSocketServer
  private clients: Map<string, WebSocketClient> = new Map()

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server })
    this.initialize()
  }

  private initialize(): void {
    this.wss.on("connection", (ws: WebSocketClient) => {
      // Assign unique ID to client
      ws.id = uuidv4()
      ws.isAlive = true
      this.clients.set(ws.id, ws)

      logger.info(`WebSocket client connected: ${ws.id}`)

      // Handle ping/pong for connection health
      ws.on("pong", () => {
        ws.isAlive = true
      })

      // Handle messages
      ws.on("message", async (message: string) => {
        try {
          const data: WebSocketMessage = JSON.parse(message)
          await this.handleMessage(ws, data)
        } catch (error: any) {
          logger.error(`WebSocket message error: ${error.message}`)
          this.sendError(ws, "Invalid message format")
        }
      })

      // Handle disconnection
      ws.on("close", () => {
        logger.info(`WebSocket client disconnected: ${ws.id}`)
        this.clients.delete(ws.id)
      })
    })

    // Set up ping interval to check for dead connections
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) {
          logger.info(`Terminating inactive WebSocket: ${ws.id}`)
          return ws.terminate()
        }

        ws.isAlive = false
        ws.ping()
      })
    }, 30000) // Check every 30 seconds
  }

  private async handleMessage(ws: WebSocketClient, message: WebSocketMessage): Promise<void> {
    const { type, payload } = message

    switch (type) {
      case "auth":
        await this.handleAuth(ws, payload)
        break

      case "message":
        await this.handleChatMessage(ws, payload)
        break

      case "typing":
        await this.handleTypingIndicator(ws, payload)
        break

      case "history":
        await this.handleHistoryRequest(ws, payload)
        break

      default:
        this.sendError(ws, `Unknown message type: ${type}`)
    }
  }

  private async handleAuth(ws: WebSocketClient, payload: any): Promise<void> {
    try {
      const { token } = payload

      if (!token) {
        return this.sendError(ws, "Authentication token required")
      }

      // Verify JWT token
      const decoded = verifyToken(token)
      ws.userId = decoded.userId

      // Create or get session
      ws.sessionId = payload.sessionId || uuidv4()

      this.send(ws, {
        type: "auth_success",
        payload: {
          userId: ws.userId,
          sessionId: ws.sessionId,
        },
      })

      logger.info(`WebSocket client authenticated: ${ws.id}, User: ${ws.userId}`)
    } catch (error: any) {
      logger.error(`WebSocket authentication error: ${error.message}`)
      this.sendError(ws, "Authentication failed")
    }
  }

  private async handleChatMessage(ws: WebSocketClient, payload: any): Promise<void> {
    try {
      if (!ws.userId) {
        return this.sendError(ws, "Authentication required")
      }

      const { message, modelPreference, context, sessionId } = payload
      const actualSessionId = sessionId || ws.sessionId

      if (!message) {
        return this.sendError(ws, "Message content required")
      }

      // Check user quota
      const user = await User.findById(ws.userId)
      if (!user) {
        return this.sendError(ws, "User not found")
      }

      if (user.usageQuota.used >= user.usageQuota.monthly) {
        return this.sendError(ws, "Monthly usage quota exceeded")
      }

      // Save user message to conversation
      let conversation = await Conversation.findOne({
        userId: new mongoose.Types.ObjectId(ws.userId),
        sessionId: actualSessionId,
      })

      if (!conversation) {
        conversation = new Conversation({
          userId: new mongoose.Types.ObjectId(ws.userId),
          sessionId: actualSessionId,
          messages: [],
          modelPreference,
        })
      }

      // Add user message
      conversation.messages.push({
        content: message,
        role: "user",
        timestamp: new Date(),
      })

      await conversation.save()

      // Send acknowledgment
      this.send(ws, {
        type: "message_received",
        payload: {
          messageId: conversation.messages[conversation.messages.length - 1]._id,
          timestamp: new Date().toISOString(),
        },
      })

      // Process with AI and stream response
      this.send(ws, {
        type: "typing_indicator",
        payload: {
          isTyping: true,
        },
      })

      // Determine which model to use
      const model = modelPreference || user.preferences.defaultModel || "hybrid"

      let responseContent = ""
      let modelUsed = ""

      if (model === "hybrid") {
        // Use both models and merge responses
        const [deepseekResponse, openaiResponse] = await Promise.allSettled([
          getDeepSeekResponse(message, context, { userId: new mongoose.Types.ObjectId(ws.userId) }),
          getOpenAIResponse(message, context),
        ])

        // Merge responses or use the successful one
        if (deepseekResponse.status === "fulfilled" && openaiResponse.status === "fulfilled") {
          responseContent = this.mergeResponses(deepseekResponse.value, openaiResponse.value)
          modelUsed = "hybrid (deepseek + openai)"
        } else if (deepseekResponse.status === "fulfilled") {
          responseContent = deepseekResponse.value
          modelUsed = "deepseek"
        } else if (openaiResponse.status === "fulfilled") {
          responseContent = openaiResponse.value
          modelUsed = "openai"
        } else {
          return this.sendError(ws, "All AI models failed to respond")
        }
      } else if (model.startsWith("deepseek")) {
        // Use DeepSeek model
        responseContent = await getDeepSeekResponse(message, context, {
          userId: new mongoose.Types.ObjectId(ws.userId),
        })
        modelUsed = model
      } else {
        // Use OpenAI model
        responseContent = await getOpenAIResponse(message, context)
        modelUsed = "openai"
      }

      // Save AI response to conversation
      conversation.messages.push({
        content: responseContent,
        role: "assistant",
        modelUsed,
        timestamp: new Date(),
      })

      await conversation.save()

      // Send complete response
      this.send(ws, {
        type: "message",
        payload: {
          id: conversation.messages[conversation.messages.length - 1]._id,
          content: responseContent,
          role: "assistant",
          modelUsed,
          timestamp: new Date().toISOString(),
          sessionId: actualSessionId,
        },
      })

      // Stop typing indicator
      this.send(ws, {
        type: "typing_indicator",
        payload: {
          isTyping: false,
        },
      })
    } catch (error: any) {
      logger.error(`WebSocket chat message error: ${error.message}`)
      this.sendError(ws, `Failed to process message: ${error.message}`)
    }
  }

  private async handleTypingIndicator(ws: WebSocketClient, payload: any): Promise<void> {
    try {
      if (!ws.userId) {
        return this.sendError(ws, "Authentication required")
      }

      const { isTyping, sessionId } = payload
      const actualSessionId = sessionId || ws.sessionId

      // Broadcast typing indicator to all clients in the same session
      this.broadcastToSession(actualSessionId, {
        type: "typing_indicator",
        payload: {
          userId: ws.userId,
          isTyping,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error: any) {
      logger.error(`WebSocket typing indicator error: ${error.message}`)
    }
  }

  private async handleHistoryRequest(ws: WebSocketClient, payload: any): Promise<void> {
    try {
      if (!ws.userId) {
        return this.sendError(ws, "Authentication required")
      }

      const { sessionId, limit } = payload
      const actualSessionId = sessionId || ws.sessionId

      // Get conversation history
      const conversation = await Conversation.findOne({
        userId: new mongoose.Types.ObjectId(ws.userId),
        sessionId: actualSessionId,
      })

      if (!conversation) {
        return this.send(ws, {
          type: "history",
          payload: {
            messages: [],
            sessionId: actualSessionId,
          },
        })
      }

      // Get messages, optionally limited
      const messages = limit ? conversation.messages.slice(-limit) : conversation.messages

      this.send(ws, {
        type: "history",
        payload: {
          messages: messages.map((msg) => ({
            id: msg._id,
            content: msg.content,
            role: msg.role,
            modelUsed: msg.modelUsed,
            timestamp: msg.timestamp,
          })),
          sessionId: actualSessionId,
          title: conversation.title,
        },
      })
    } catch (error: any) {
      logger.error(`WebSocket history request error: ${error.message}`)
      this.sendError(ws, `Failed to get history: ${error.message}`)
    }
  }

  private send(ws: WebSocketClient, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }

  private sendError(ws: WebSocketClient, message: string): void {
    this.send(ws, {
      type: "error",
      payload: {
        message,
        timestamp: new Date().toISOString(),
      },
    })
  }

  private broadcastToSession(sessionId: string, data: any): void {
    this.clients.forEach((client) => {
      if (client.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data))
      }
    })
  }

  private mergeResponses(response1: string, response2: string): string {
    // Simple merging strategy - could be enhanced with more sophisticated analysis
    return `
## First AI Response
${response1}

## Second AI Response
${response2}

## Combined Analysis
Both AI models have provided insights on this topic. Consider the strengths of each approach when forming your conclusion.
`
  }
}
