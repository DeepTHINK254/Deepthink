import mongoose, { type Document, Schema } from "mongoose"

export interface IApiUsage extends Document {
  userId: mongoose.Types.ObjectId
  endpoint: string
  model: string
  tokensUsed: number
  cost: number
  timestamp: Date
}

const ApiUsageSchema = new Schema<IApiUsage>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  tokensUsed: {
    type: Number,
    required: true,
  },
  cost: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

export const ApiUsage = mongoose.model<IApiUsage>("ApiUsage", ApiUsageSchema)
