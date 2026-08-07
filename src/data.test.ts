import { describe, expect, it } from 'vitest'
import { parseCosts, parseTimeline, parseTsv, summarizeCosts } from './data'

describe('TSV parser', () => {
  it('keeps empty values and quoted tabs', () => {
    const rows = parseTsv('a\tb\tc\n1\t\t"two\tparts"\n')
    expect(rows).toEqual([{ a: '1', b: '', c: 'two\tparts' }])
  })

  it('parses timeline values', () => {
    const entries = parseTimeline(
      'date\tphase\tevent\tstatus\tdays_from_activity_start\tnote\n2026-08-03\t活動開始\t登録完了\t完了\t0\t\n',
    )
    expect(entries[0].daysFromActivityStart).toBe(0)
    expect(entries[0].event).toBe('登録完了')
  })

  it('separates direct costs, self investment, and unknown values', () => {
    const costs = parseCosts(
      [
        'date\tcategory\titem\tamount_jpy\tquantity\tunit_price_jpy\tstatus\tcost_scope\tnote',
        '2026-08-01\t写真\t撮影\t13750\t1\t13750\t支払済\tdirect\t',
        '\t衣類\t靴\t\t1\t\t予定\tplanned\t',
        '\t相談所\t月会費\t\t1\t18700\t継続\trecurring\t',
        '\t眼鏡\t眼鏡\t13200\t1\t13200\t実績\tself_investment\t',
      ].join('\n'),
    )

    expect(summarizeCosts(costs)).toEqual({
      direct: 13750,
      selfInvestment: 13200,
      excluded: 0,
      unknownCount: 1,
      recurringUnitPrice: 18700,
    })
  })
})
