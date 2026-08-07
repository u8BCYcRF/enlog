export type TimelineEntry = {
  date: string
  phase: string
  event: string
  status: string
  daysFromActivityStart: number | null
  note: string
}

export type CostScope =
  | 'direct'
  | 'self_investment'
  | 'excluded'
  | 'recurring'
  | 'progress'
  | 'planned'
  | string

export type CostEntry = {
  date: string
  category: string
  item: string
  amountJpy: number | null
  quantity: number | null
  unitPriceJpy: number | null
  status: string
  costScope: CostScope
  note: string
}

export type CostSummary = {
  direct: number
  selfInvestment: number
  excluded: number
  unknownCount: number
  recurringUnitPrice: number
}

export type DashboardData = {
  timeline: TimelineEntry[]
  costs: CostEntry[]
}
