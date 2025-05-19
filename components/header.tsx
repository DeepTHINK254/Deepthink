import { BrainCircuit, Settings } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950 flex items-center justify-between p-3 h-14">
      <div className="flex items-center space-x-2">
        <BrainCircuit size={24} className="text-blue-500" />
        <div>
          <h1 className="text-xl font-bold tracking-wider">DEEPTHINK</h1>
          <p className="text-xs text-zinc-400">Reasoning with Ethics</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 text-zinc-400 hover:text-zinc-100 rounded-full hover:bg-zinc-800">
          <Settings size={20} />
        </button>
      </div>
    </header>
  )
}
