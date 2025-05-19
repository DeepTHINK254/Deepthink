"use client"

import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { useDeepThinkStore } from "@/lib/store"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

export function CollaborativeWorkspace() {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState<
    {
      role: "user" | "assistant"
      content: string
      timestamp: number
    }[]
  >([
    {
      role: "assistant",
      content: "Welcome to DeepTHINK. How can I assist you with reasoning today?",
      timestamp: Date.now(),
    },
  ])

  const { setConfidence } = useDeepThinkStore()

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    // Add user message to conversation
    setConversation((prev) => [...prev, { role: "user", content: input, timestamp: Date.now() }])

    const userQuery = input
    setInput("")
    setIsLoading(true)

    // Simulate AI processing
    setTimeout(() => {
      // Generate a random confidence between 0.6 and 0.95
      const newConfidence = 0.6 + Math.random() * 0.35
      setConfidence(newConfidence)

      // Add AI response
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Further investigation is warranted because the research suggests a potential correlation, but the data may contain demographic biases that need to be addressed before drawing firm conclusions.",
          timestamp: Date.now(),
        },
      ])

      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4">
          {conversation.map((message, index) => (
            <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-100"
                }`}
              >
                <p>{message.content}</p>
                <div className="text-xs opacity-70 mt-1">{new Date(message.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-3 bg-zinc-800 text-zinc-100">
                <div className="flex items-center space-x-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>DeepTHINK is reasoning...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex space-x-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask DeepTHINK something..."
            className="min-h-[60px] bg-zinc-800 border-zinc-700"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <Button onClick={handleSubmit} disabled={isLoading || !input.trim()} size="icon" className="h-auto">
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
}
