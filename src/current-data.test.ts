import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCosts, parseTimeline, summarizeCosts } from './data'

const timelineSource = readFileSync(
  new URL('../data/timeline.tsv', import.meta.url),
  'utf8',
)
const costsSource = readFileSync(
  new URL('../data/costs.tsv', import.meta.url),
  'utf8',
)

describe('current Enlog data', () => {
  it('loads every current timeline and cost record', () => {
    expect(parseTimeline(timelineSource)).toHaveLength(17)
    expect(parseCosts(costsSource)).toHaveLength(19)
  })

  it('calculates current cost scopes without double counting', () => {
    expect(summarizeCosts(parseCosts(costsSource))).toEqual({
      direct: 157450,
      selfInvestment: 393090,
      excluded: 2510,
      unknownCount: 1,
      recurringUnitPrice: 18700,
    })
  })
})
