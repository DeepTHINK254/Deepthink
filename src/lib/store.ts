// This is a simplified store for the backend only
// It doesn't include any frontend-specific state

import NodeCache from "node-cache"

// Initialize cache with TTL of 5 minutes
export const responseCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  maxKeys: 1000, // Maximum number of keys in cache
})

// Simple in-memory store for request tracking
export const requestStore = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,

  // Method to increment counters
  trackRequest(success: boolean) {
    this.totalRequests++
    if (success) {
      this.successfulRequests++
    } else {
      this.failedRequests++
    }
  },

  // Method to get stats
  getStats() {
    return {
      total: this.totalRequests,
      successful: this.successfulRequests,
      failed: this.failedRequests,
      successRate: this.totalRequests > 0 ? (this.successfulRequests / this.totalRequests) * 100 : 0,
    }
  },

  // Reset stats
  resetStats() {
    this.totalRequests = 0
    this.successfulRequests = 0
    this.failedRequests = 0
  },
}
