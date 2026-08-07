import type {
  CostEntry,
  CostSummary,
  DashboardData,
  TimelineEntry,
} from './types'

function parseRows(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const text = source.replace(/^\uFEFF/, '')

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === '\t' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

export function parseTsv(source: string): Record<string, string>[] {
  const [header = [], ...rows] = parseRows(source)
  return rows.map((row) =>
    Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])),
  )
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseTimeline(source: string): TimelineEntry[] {
  return parseTsv(source).map((entry) => ({
    date: entry.date,
    phase: entry.phase,
    event: entry.event,
    status: entry.status,
    daysFromActivityStart: optionalNumber(entry.days_from_activity_start),
    note: entry.note,
  }))
}

export function parseCosts(source: string): CostEntry[] {
  return parseTsv(source).map((entry) => ({
    date: entry.date,
    category: entry.category,
    item: entry.item,
    amountJpy: optionalNumber(entry.amount_jpy),
    quantity: optionalNumber(entry.quantity),
    unitPriceJpy: optionalNumber(entry.unit_price_jpy),
    status: entry.status,
    costScope: entry.cost_scope,
    note: entry.note,
  }))
}

export function summarizeCosts(costs: CostEntry[]): CostSummary {
  return costs.reduce<CostSummary>(
    (summary, cost) => {
      const amount = cost.amountJpy ?? 0

      if (['direct', 'recurring', 'progress'].includes(cost.costScope)) {
        summary.direct += amount
      }
      if (cost.costScope === 'self_investment') {
        summary.selfInvestment += amount
      }
      if (cost.costScope === 'excluded') {
        summary.excluded += amount
      }
      if (cost.amountJpy === null && ['direct', 'planned'].includes(cost.costScope)) {
        summary.unknownCount += 1
      }
      if (cost.costScope === 'recurring' && cost.unitPriceJpy !== null) {
        summary.recurringUnitPrice += cost.unitPriceJpy
      }

      return summary
    },
    {
      direct: 0,
      selfInvestment: 0,
      excluded: 0,
      unknownCount: 0,
      recurringUnitPrice: 0,
    },
  )
}

async function fetchText(path: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${path}?v=${Date.now()}`, {
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`${path} の読み込みに失敗しました (${response.status})`)
  }

  return response.text()
}

export async function loadDashboardData(
  signal?: AbortSignal,
): Promise<DashboardData> {
  const dataBasePath = `${import.meta.env.BASE_URL}data`
  const [timelineSource, costsSource] = await Promise.all([
    fetchText(`${dataBasePath}/timeline.tsv`, signal),
    fetchText(`${dataBasePath}/costs.tsv`, signal),
  ])

  return {
    timeline: parseTimeline(timelineSource),
    costs: parseCosts(costsSource),
  }
}
