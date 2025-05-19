import express from "express"
import { authenticate, checkQuota } from "../middleware/authMiddleware"
import { Conversation } from "../models/conversation"
import { logger } from "../utils/logger"

export const conversationRouter = express.Router()

// Get all conversations for the current user
conversationRouter.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.userId
    const conversations = await Conversation.find({ userId })
      .select("title sessionId createdAt lastMessageAt")
      .sort({ lastMessageAt: -1 })

    res.json(conversations)
  } catch (error) {
    logger.error("Get conversations error:", error)
    res.status(500).json({ error: "Failed to get conversations" })
  }
})

// Get a specific conversation
conversationRouter.get("/:sessionId", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user.userId

    const conversation = await Conversation.findOne({
      userId,
      sessionId,
    })

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    res.json(conversation)
  } catch (error) {
    logger.error("Get conversation error:", error)
    res.status(500).json({ error: "Failed to get conversation" })
  }
})

// Create a new message in a conversation
conversationRouter.post("/:sessionId/messages", authenticate, checkQuota, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { content, role } = req.body
    const userId = req.user.userId

    if (!content || !role) {
      return res.status(400).json({ error: "Content and role are required" })
    }

    let conversation = await Conversation.findOne({
      userId,
      sessionId,
    })

    if (!conversation) {
      conversation = new Conversation({
        userId,
        sessionId,
        messages: [],
      })
    }

    conversation.messages.push({
      content,
      role,
      timestamp: new Date(),
    })

    await conversation.save()

    res.status(201).json({
      message: conversation.messages[conversation.messages.length - 1],
      conversationId: conversation._id,
    })
  } catch (error) {
    logger.error("Create message error:", error)
    res.status(500).json({ error: "Failed to create message" })
  }
})

// Update conversation title
conversationRouter.put("/:sessionId", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { title } = req.body
    const userId = req.user.userId

    if (!title) {
      return res.status(400).json({ error: "Title is required" })
    }

    const conversation = await Conversation.findOneAndUpdate({ userId, sessionId }, { title }, { new: true })

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    res.json({ title: conversation.title })
  } catch (error) {
    logger.error("Update conversation error:", error)
    res.status(500).json({ error: "Failed to update conversation" })
  }
})

// Delete a conversation
conversationRouter.delete("/:sessionId", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params
    const userId = req.user.userId

    const result = await Conversation.deleteOne({
      userId,
      sessionId,
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    res.json({ message: "Conversation deleted successfully" })
  } catch (error) {
    logger.error("Delete conversation error:", error)
    res.status(500).json({ error: "Failed to delete conversation" })
  }
})

export default conversationRouter
