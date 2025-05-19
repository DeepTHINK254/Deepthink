"use client"

import { Header } from "@/components/header"
import { ReasoningCanvas } from "@/components/reasoning-canvas"
import { CollaborativeWorkspace } from "@/components/collaborative-workspace"
import { EthicsPanel } from "@/components/ethics-panel"
import { ConfidenceMeter } from "@/components/confidence-meter"
import { useState } from "react"
import { useDeepThinkStore } from "@/lib/store"

export default function Home() {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false)
  const [isEthicsExpanded, setIsEthicsExpanded] = useState(false)
  const { confidence } = useDeepThinkStore()

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Left Panel - Reasoning Canvas */}
        <div
          className={`border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-950 transition-all ${
            isReasoningExpanded ? "w-full md:w-1/2" : "w-full md:w-1/4"
          }`}
        >
          <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Reasoning Canvas</h2>
            <button
              onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              {isReasoningExpanded ? "Minimize" : "Expand"}
            </button>
          </div>
          <div className="h-[calc(100%-53px)]">
            <ReasoningCanvas />
          </div>
        </div>

        {/* Center Panel - Collaborative Workspace */}
        <div
          className={`flex-1 flex flex-col bg-zinc-900 ${
            isReasoningExpanded && isEthicsExpanded ? "hidden md:flex" : ""
          }`}
        >
          <CollaborativeWorkspace />
        </div>

        {/* Right Panel - Ethics & Context */}
        <div
          className={`border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950 transition-all ${
            isEthicsExpanded ? "w-full md:w-1/2" : "w-full md:w-1/4"
          }`}
        >
          <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Ethics & Context</h2>
            <button
              onClick={() => setIsEthicsExpanded(!isEthicsExpanded)}
              className="text-zinc-400 hover:text-zinc-100"
            >
              {isEthicsExpanded ? "Minimize" : "Expand"}
            </button>
          </div>
          <div className="h-[calc(100%-53px)] overflow-y-auto">
            <EthicsPanel />
          </div>
        </div>
      </div>

      {/* Bottom Bar - Confidence Meter */}
      <div className="border-t border-zinc-800 p-4">
        <ConfidenceMeter confidence={confidence} />
      </div>
    </main>
  )
}
