import mongoose, { type Document, Schema } from "mongoose"
import { v4 as uuidv4 } from "uuid"
import bcrypt from "bcryptjs"

export interface IUser extends Document {
  username: string
  email: string
  password: string
  apiKey: string
  role: "admin" | "user"
  usageQuota: {
    monthly: number
    used: number
    resetDate: Date
  }
  preferences: {
    defaultModel: string
    theme: string
    language: string
  }
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
  generateApiKey(): string
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    apiKey: {
      type: String,
      unique: true,
      default: () => `dk_${uuidv4().replace(/-/g, "")}`,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    usageQuota: {
      monthly: {
        type: Number,
        default: 100, // Default monthly quota
      },
      used: {
        type: Number,
        default: 0,
      },
      resetDate: {
        type: Date,
        default: () => {
          const now = new Date()
          return new Date(now.getFullYear(), now.getMonth() + 1, 1) // First day of next month
        },
      },
    },
    preferences: {
      defaultModel: {
        type: String,
        default: "deepseek-v3",
      },
      theme: {
        type: String,
        default: "light",
      },
      language: {
        type: String,
        default: "en",
      },
    },
  },
  {
    timestamps: true,
  },
)

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error: any) {
    next(error)
  }
})

// Method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

// Method to generate new API key
UserSchema.methods.generateApiKey = function (): string {
  this.apiKey = `dk_${uuidv4().replace(/-/g, "")}`
  return this.apiKey
}

export const User = mongoose.model<IUser>("User", UserSchema)
