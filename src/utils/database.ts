import mongoose from "mongoose"
import { logger } from "./logger"

// Database connection options
const options = {
  autoIndex: true,
  serverSelectionTimeoutMS: 5000,
}

// Connect to MongoDB
export const connectToDatabase = async (): Promise<void> => {
  const MONGODB_URI = process.env.MONGODB_URI

  if (!MONGODB_URI) {
    logger.error("MONGODB_URI environment variable is not defined")
    process.exit(1)
  }

  try {
    await mongoose.connect(MONGODB_URI, options)
    logger.info("Connected to MongoDB")
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error)
    process.exit(1)
  }
}

// Handle connection events
mongoose.connection.on("error", (err) => {
  logger.error("MongoDB connection error:", err)
})

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected")
})

process.on("SIGINT", async () => {
  await mongoose.connection.close()
  logger.info("MongoDB connection closed due to app termination")
  process.exit(0)
})
