import { create } from "zustand"

export interface LogicNode {
  id: string
  label: string
  value: string
  type: "premise" | "inference" | "conclusion"
  confidence: number
  ethicalRisk: boolean
  connections: string[]
}

export interface Citation {
  id: string
  title: string
  url: string
  reliability: number
}

export interface EthicsAlert {
  id: string
  type: "bias" | "fairness" | "safety" | "privacy"
  message: string
  severity: "low" | "medium" | "high"
  timestamp: number
}

interface DeepThinkState {
  // Reasoning state
  reasoningNodes: LogicNode[]
  selectedNode: string | null
  confidence: number

  // Ethics state
  ethicsAlerts: EthicsAlert[]
  citations: Citation[]

  // Actions
  addReasoningNode: (node: LogicNode) => void
  selectNode: (nodeId: string | null) => void
  addEthicsAlert: (alert: EthicsAlert) => void
  clearEthicsAlerts: () => void
  setConfidence: (value: number) => void
}

export const useDeepThinkStore = create<DeepThinkState>((set) => ({
  // Initial state
  reasoningNodes: [
    {
      id: "n1",
      label: "Initial Premise",
      value: "User input considered",
      type: "premise",
      confidence: 0.95,
      ethicalRisk: false,
      connections: ["n2", "n3"],
    },
    {
      id: "n2",
      label: "Reference Data",
      value: "Scientific literature",
      type: "premise",
      confidence: 0.88,
      ethicalRisk: false,
      connections: ["n4"],
    },
    {
      id: "n3",
      label: "Statistical Analysis",
      value: "Correlation identified",
      type: "inference",
      confidence: 0.72,
      ethicalRisk: false,
      connections: ["n4"],
    },
    {
      id: "n4",
      label: "Potential Bias",
      value: "Demographic skew in data",
      type: "inference",
      confidence: 0.63,
      ethicalRisk: true,
      connections: ["n5"],
    },
    {
      id: "n5",
      label: "Conclusion",
      value: "Further research needed",
      type: "conclusion",
      confidence: 0.7,
      ethicalRisk: false,
      connections: [],
    },
  ],
  selectedNode: null,
  confidence: 0.7,

  ethicsAlerts: [
    {
      id: "a1",
      type: "bias",
      message: "Potential demographic bias detected",
      severity: "medium",
      timestamp: Date.now(),
    },
  ],
  citations: [
    {
      id: "c1",
      title: "Dataset Report, 2022",
      url: "https://example.com/report",
      reliability: 0.85,
    },
  ],

  // Actions
  addReasoningNode: (node) =>
    set((state) => ({
      reasoningNodes: [...state.reasoningNodes, node],
    })),

  selectNode: (nodeId) => set({ selectedNode: nodeId }),

  addEthicsAlert: (alert) =>
    set((state) => ({
      ethicsAlerts: [...state.ethicsAlerts, alert],
    })),

  clearEthicsAlerts: () => set({ ethicsAlerts: [] }),

  setConfidence: (value) => set({ confidence: value }),
}))
