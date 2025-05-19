import mongoose, { type Document, Schema } from "mongoose"
import { v4 as uuidv4 } from "uuid"

export interface IMessage {
  content: string
  role: "user" | "system" | "assistant"
  modelUsed?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface IConversation extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  sessionId: string
  messages: IMessage[]
  modelPreference?: string
  createdAt: Date
  updatedAt: Date
  lastMessageAt: Date
}

const MessageSchema = new Schema<IMessage>({
  content: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "system", "assistant"],
    required: true,
  },
  modelUsed: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
})

const ConversationSchema = new Schema<IConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "New Conversation",
    },
    sessionId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
    },
    messages: [MessageSchema],
    modelPreference: {
      type: String,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Update lastMessageAt when messages are added
ConversationSchema.pre("save", function (next) {
  if (this.isModified("messages")) {
    this.lastMessageAt = new Date()
  }
  next()
})

// Generate title from first message if not set
ConversationSchema.pre("save", function (next) {
  if (this.isNew && !this.title && this.messages.length > 0) {
    const firstUserMessage = this.messages.find((m) => m.role === "user")
    if (firstUserMessage) {
      // Truncate and use first message as title
      this.title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
    }
  }
  next()
})

export const Conversation = mongoose.model<IConversation>("Conversation", ConversationSchema)
