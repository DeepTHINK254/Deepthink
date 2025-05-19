"use client"

import { useDeepThinkStore } from "@/lib/store"
import { AlertTriangle, BookOpen, Check, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function EthicsPanel() {
  const { ethicsAlerts, citations, selectedNode, reasoningNodes } = useDeepThinkStore()

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Ethics Alerts Section */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Ethics Alerts</h3>

          {ethicsAlerts.length === 0 ? (
            <div className="flex items-center space-x-2 p-3 bg-zinc-900/50 text-zinc-400 rounded border border-zinc-800 text-sm">
              <Check size={16} className="text-green-500" />
              <span>No ethical concerns detected</span>
            </div>
          ) : (
            <div className="space-y-3">
              {ethicsAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded border text-sm",
                    alert.severity === "high"
                      ? "bg-red-950/20 border-red-800/50 text-red-200"
                      : alert.severity === "medium"
                        ? "bg-amber-950/20 border-amber-800/50 text-amber-200"
                        : "bg-blue-950/20 border-blue-800/50 text-blue-200",
                  )}
                >
                  <div className="flex items-start space-x-2">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium mb-1">{alert.message}</div>
                      <div className="text-xs opacity-80">
                        {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} concern •{" "}
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Node Details (if any) */}
        {selectedNode && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Selected Node Details</h3>

            <div className="bg-zinc-900/50 rounded border border-zinc-800 p-3">
              {(() => {
                const node = reasoningNodes.find((n) => n.id === selectedNode)
                if (!node) return null

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">{node.label}</h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          node.type === "premise"
                            ? "border-emerald-500/40 text-emerald-400"
                            : node.type === "inference"
                              ? "border-blue-500/40 text-blue-400"
                              : "border-purple-500/40 text-purple-400",
                        )}
                      >
                        {node.type}
                      </Badge>
                    </div>

                    <p className="text-sm text-zinc-400">{node.value}</p>

                    <div className="flex items-center text-xs space-x-2">
                      <div
                        className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden"
                        title={`Confidence: ${(node.confidence * 100).toFixed(1)}%`}
                      >
                        <div
                          className={cn(
                            "h-full",
                            node.confidence > 0.8
                              ? "bg-green-500"
                              : node.confidence > 0.6
                                ? "bg-blue-500"
                                : node.confidence > 0.4
                                  ? "bg-amber-500"
                                  : "bg-red-500",
                          )}
                          style={{ width: `${node.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-zinc-500">{(node.confidence * 100).toFixed(0)}%</span>
                    </div>

                    {node.ethicalRisk && (
                      <div className="text-xs p-1.5 bg-red-950/20 border border-red-800/30 rounded text-red-300 mt-1">
                        <span className="font-medium">Ethical risk detected:</span> This node may contain reasoning
                        based on potentially biased data.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Knowledge Sources */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Knowledge Sources</h3>

          <div className="space-y-2">
            {citations.map((citation) => (
              <div
                key={citation.id}
                className="flex justify-between items-center p-2 hover:bg-zinc-900/50 rounded group"
              >
                <div className="flex items-center space-x-2">
                  <BookOpen size={14} className="text-zinc-500" />
                  <span className="text-sm">{citation.title}</span>
                </div>

                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
