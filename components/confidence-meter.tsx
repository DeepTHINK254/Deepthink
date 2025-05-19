import { cn } from "@/lib/utils"

interface ConfidenceMeterProps {
  confidence: number
}

export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  // Format confidence value to 1 decimal place
  const formattedConfidence = (confidence * 100).toFixed(1)

  // Determine color based on confidence level
  const getColor = () => {
    if (confidence >= 0.8) return "from-blue-500 to-purple-500"
    if (confidence >= 0.6) return "from-blue-500 to-teal-500"
    if (confidence >= 0.4) return "from-yellow-500 to-orange-500"
    return "from-red-500 to-pink-500"
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium">Confidence</div>
        <div className="text-sm">{formattedConfidence}%</div>
      </div>

      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full bg-gradient-to-r transition-all duration-700", getColor())}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-zinc-500">
        <span>Uncertain</span>
        <span>Certain</span>
      </div>
    </div>
  )
}
