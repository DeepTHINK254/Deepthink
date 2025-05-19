"use client"

import { useRef, useState } from "react"
import { useDeepThinkStore, type LogicNode } from "@/lib/store"
import { motion } from "framer-motion"
import { ZoomIn, ZoomOut } from "lucide-react"

export function ReasoningCanvas() {
  const { reasoningNodes, selectedNode, selectNode } = useDeepThinkStore()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Logic to calculate node positions in a force-directed layout
  const getNodePosition = (node: LogicNode, index: number) => {
    const radius = 120 * scale
    const angle = (index / reasoningNodes.length) * Math.PI * 2
    const x = Math.cos(angle) * radius + 150
    const y = Math.sin(angle) * radius + 150
    return { x, y }
  }

  // Function to handle zoom in/out
  const handleZoom = (zoomIn: boolean) => {
    setScale((prev) => {
      const newScale = zoomIn ? prev * 1.2 : prev * 0.8
      return Math.min(Math.max(newScale, 0.5), 2) // Clamp between 0.5 and 2
    })
  }

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col space-y-2">
        <button
          onClick={() => handleZoom(true)}
          className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-300"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => handleZoom(false)}
          className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-300"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Graph visualization */}
      <div
        ref={canvasRef}
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-zinc-950"
      >
        {/* Canvas grid background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div key={`h-${i}`} className="absolute w-full h-px bg-blue-500" style={{ top: i * 30 }} />
          ))}
          {[...Array(20)].map((_, i) => (
            <div key={`v-${i}`} className="absolute h-full w-px bg-blue-500" style={{ left: i * 30 }} />
          ))}
        </div>

        {/* Connection lines between nodes */}
        <svg className="absolute inset-0 pointer-events-none">
          {reasoningNodes.map((node) =>
            node.connections.map((targetId) => {
              const target = reasoningNodes.find((n) => n.id === targetId)
              if (!target) return null

              const sourcePos = getNodePosition(node, reasoningNodes.indexOf(node))
              const targetPos = getNodePosition(target, reasoningNodes.indexOf(target))

              return (
                <line
                  key={`${node.id}-${targetId}`}
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke="rgba(59, 130, 246, 0.4)"
                  strokeWidth={node.ethicalRisk || target.ethicalRisk ? 2 : 1}
                  strokeDasharray={node.ethicalRisk || target.ethicalRisk ? "5,5" : ""}
                />
              )
            }),
          )}
        </svg>

        {/* Nodes */}
        {reasoningNodes.map((node, index) => {
          const { x, y } = getNodePosition(node, index)
          const nodeColor = node.ethicalRisk
            ? "bg-red-500/20 border-red-500/40"
            : node.type === "conclusion"
              ? "bg-purple-500/20 border-purple-500/40"
              : node.type === "inference"
                ? "bg-blue-500/20 border-blue-500/40"
                : "bg-emerald-500/20 border-emerald-500/40"

          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: 1,
                scale: selectedNode === node.id ? 1.1 : 1,
                x: x - 50, // center the node
                y: y - 50,
              }}
              transition={{ duration: 0.3 }}
              className={`absolute w-24 h-24 rounded-full cursor-pointer ${nodeColor} border flex items-center justify-center text-center text-xs p-2 transition-all`}
              style={{
                boxShadow: `0 0 15px ${node.ethicalRisk ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
              }}
              onClick={() => selectNode(node.id === selectedNode ? null : node.id)}
            >
              {node.label}
            </motion.div>
          )
        })}
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 right-3 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg p-3 shadow-lg text-sm">
          <h3 className="font-medium mb-1">{reasoningNodes.find((n) => n.id === selectedNode)?.label}</h3>
          <p className="text-zinc-400 mb-2">{reasoningNodes.find((n) => n.id === selectedNode)?.value}</p>
          <div className="flex justify-between items-center text-xs text-zinc-500">
            <span>Confidence: {(reasoningNodes.find((n) => n.id === selectedNode)?.confidence || 0) * 100}%</span>
            <button className="text-blue-400 hover:text-blue-300" onClick={() => selectNode(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
