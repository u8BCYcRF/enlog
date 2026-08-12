import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadDashboardData, summarizeCosts } from './data'
import type { CostEntry, DashboardData, TimelineEntry } from './types'

const yenFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'short',
  day: 'numeric',
  weekday: 'short',
})

const fullDateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const scopeLabels: Record<string, string> = {
  direct: '婚活直接費',
  self_investment: '自己投資',
  excluded: '集計対象外',
  recurring: '継続費',
  progress: '契約内進捗',
  planned: '購入予定',
}

type CostFilter = 'all' | 'direct' | 'self' | 'other'

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`)
}

function formatDate(date: string): string {
  return date ? dateFormatter.format(parseLocalDate(date)) : '日付未確定'
}

function formatFullDate(date: string): string {
  return date ? fullDateFormatter.format(parseLocalDate(date)) : '日付未確定'
}

function formatYen(amount: number): string {
  return yenFormatter.format(amount)
}

function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].reverse().sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })
}

function AppIcon({ name }: { name: 'calendar' | 'coin' | 'spark' | 'refresh' | 'arrow' }) {
  const paths = {
    calendar: (
      <>
        <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        <path d="m8 14 2.5 2.5L16 11" />
      </>
    ),
    coin: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 8.5 12 12l3.5-3.5M12 12v5M9.5 14.5h5" />
      </>
    ),
    spark: (
      <>
        <path d="M12 2.8c.5 5 2.2 6.7 7.2 7.2-5 .5-6.7 2.2-7.2 7.2-.5-5-2.2-6.7-7.2-7.2 5-.5 6.7-2.2 7.2-7.2Z" />
        <path d="M18.5 16.5c.2 2.1.9 2.8 3 3-2.1.2-2.8.9-3 3-.2-2.1-.9-2.8-3-3 2.1-.2 2.8-.9 3-3Z" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 5v6h-6" />
      </>
    ),
    arrow: <path d="m8 5 7 7-7 7" />,
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = ['完了', '支払済', '実績', '実施済'].includes(status)
    ? 'done'
    : ['予定', '継続'].includes(status)
      ? 'future'
      : status === '保留'
        ? 'pending'
        : 'neutral'

  return <span className={`status-badge status-${tone}`}>{status}</span>
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'plain',
}: {
  label: string
  value: string
  detail: string
  tone?: 'plain' | 'coral' | 'green'
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  )
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const chronologicalEntries = [...entries].sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  const dayLabel = (days: number | null) => {
    if (days === null) return '日数未設定'
    if (days === 0) return '活動開始'
    if (days < 0) return `開始${Math.abs(days)}日前`
    return `開始${days}日後`
  }

  return (
    <ol className="timeline-list">
      {chronologicalEntries.map((entry) => (
        <li
          className={`timeline-item ${entry.daysFromActivityStart === 0 ? 'timeline-start' : ''} ${['予定', '保留', '未確認'].includes(entry.status) ? 'timeline-open' : ''}`}
          key={`${entry.date}-${entry.event}`}
        >
          <div className="timeline-marker" aria-hidden="true">
            <span />
          </div>
          <div className="timeline-copy">
            <div className="timeline-meta">
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              <span className="relative-day">{dayLabel(entry.daysFromActivityStart)}</span>
            </div>
            <div className="timeline-title-row">
              <div>
                <span className="timeline-phase">{entry.phase}</span>
                <h3>{entry.event}</h3>
              </div>
              <StatusBadge status={entry.status} />
            </div>
            {entry.note && <p>{entry.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function CostAmount({ cost }: { cost: CostEntry }) {
  if (cost.amountJpy !== null) {
    return <strong>{formatYen(cost.amountJpy)}</strong>
  }

  if (cost.costScope === 'recurring' && cost.unitPriceJpy !== null) {
    return (
      <span className="amount-reference">
        月額 {formatYen(cost.unitPriceJpy)}
      </span>
    )
  }

  return <span className="amount-unknown">金額未確定</span>
}

function CostTable({ costs }: { costs: CostEntry[] }) {
  const [filter, setFilter] = useState<CostFilter>('all')

  const filteredCosts = useMemo(() => {
    if (filter === 'all') return costs
    if (filter === 'direct') {
      return costs.filter((cost) =>
        ['direct', 'recurring', 'progress'].includes(cost.costScope),
      )
    }
    if (filter === 'self') {
      return costs.filter((cost) => cost.costScope === 'self_investment')
    }
    return costs.filter((cost) =>
      ['planned', 'excluded'].includes(cost.costScope),
    )
  }, [costs, filter])

  return (
    <>
      <div className="filter-row" role="group" aria-label="費用の表示対象">
        {(
          [
            ['all', 'すべて'],
            ['direct', '婚活費'],
            ['self', '自己投資'],
            ['other', '予定・対象外'],
          ] as [CostFilter, string][]
        ).map(([value, label]) => (
          <button
            className={filter === value ? 'filter-active' : ''}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="cost-table-wrap">
        <table className="cost-table">
          <thead>
            <tr>
              <th>項目</th>
              <th>区分</th>
              <th>状態</th>
              <th className="align-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {filteredCosts.map((cost, index) => (
              <tr key={`${cost.date}-${cost.item}-${index}`}>
                <td>
                  <div className="cost-item">
                    <span>{cost.item}</span>
                    <small>
                      {formatDate(cost.date)} · {cost.category}
                    </small>
                  </div>
                </td>
                <td>
                  <span className={`scope-label scope-${cost.costScope}`}>
                    {scopeLabels[cost.costScope] ?? cost.costScope}
                  </span>
                </td>
                <td>
                  <StatusBadge status={cost.status} />
                </td>
                <td className="align-right cost-amount">
                  <CostAmount cost={cost} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Dashboard({ data, onReload, isRefreshing }: { data: DashboardData; onReload: () => void; isRefreshing: boolean }) {
  const costSummary = useMemo(() => summarizeCosts(data.costs), [data.costs])
  const sortedTimeline = useMemo(() => sortByDate(data.timeline), [data.timeline])
  const latestEntry = sortedTimeline[0]
  const latestRecordedDay = latestEntry?.daysFromActivityStart ?? 0
  const offerEntries = data.timeline.filter((entry) => entry.phase === '申し受け')
  const pendingOfferCount = offerEntries.filter((entry) => entry.status === '保留').length
  const unconfirmedOfferCount = offerEntries.filter((entry) => entry.status === '未確認').length
  const answeredOfferCount = offerEntries.filter((entry) =>
    ['回答済', '承諾済', 'お断り'].includes(entry.status),
  ).length

  const nextActions = useMemo(() => {
    const timelineActions = data.timeline
      .filter((entry) => ['予定', '保留', '未確認'].includes(entry.status))
      .map((entry) => ({
        date: entry.date,
        title: entry.event,
        meta: entry.phase,
        status: entry.status,
      }))

    const costActions = data.costs
      .filter((cost) => cost.status === '予定')
      .map((cost) => ({
        date: cost.date,
        title: cost.item,
        meta: cost.category,
        status: cost.status,
      }))

    return [...timelineActions, ...costActions].sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }, [data])

  const costTotal = costSummary.direct + costSummary.selfInvestment
  const directRatio = costTotal ? (costSummary.direct / costTotal) * 100 : 0
  const selfRatio = costTotal ? (costSummary.selfInvestment / costTotal) * 100 : 0

  const directCategories = useMemo(() => {
    const totals = new Map<string, number>()
    data.costs
      .filter(
        (cost) =>
          ['direct', 'recurring', 'progress'].includes(cost.costScope) &&
          cost.amountJpy !== null,
      )
      .forEach((cost) => {
        totals.set(cost.category, (totals.get(cost.category) ?? 0) + (cost.amountJpy ?? 0))
      })

    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [data.costs])

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Enlog トップへ">
          <span className="brand-mark">E</span>
          <span>
            <strong>Enlog</strong>
            <small>Activity journal</small>
          </span>
        </a>
        <div className="topbar-actions">
          <span className="updated-at">
            最終記録 {latestEntry ? formatFullDate(latestEntry.date) : '—'}
          </span>
          <button
            className="refresh-button"
            disabled={isRefreshing}
            onClick={onReload}
            type="button"
          >
            <AppIcon name="refresh" />
            <span>{isRefreshing ? '読込中' : '再読込'}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> ACTIVITY SNAPSHOT</p>
            <h1>
              はじまりを、
              <br />ちゃんと残す。
            </h1>
            <p className="hero-description">
              準備から出会いまで、今の位置と積み重ねを静かに見渡すための活動ダッシュボード。
            </p>
          </div>
          <article className="hero-cost-card" aria-label="記録済みの費用総額">
            <div className="hero-cost-heading">
              <div>
                <span className="hero-cost-icon"><AppIcon name="coin" /></span>
                <p>TOTAL INVESTMENT</p>
              </div>
              <span className="hero-day-pill">
                DAY <strong>{String(latestRecordedDay).padStart(2, '0')}</strong>
              </span>
            </div>

            <div className="hero-cost-main">
              <p>これまでの総支出</p>
              <strong>{formatYen(costTotal)}</strong>
              <span>婚活直接費＋自己投資</span>
            </div>

            <div className="hero-cost-breakdown">
              <div>
                <span>婚活直接費</span>
                <strong>{formatYen(costSummary.direct)}</strong>
              </div>
              <div>
                <span>自己投資</span>
                <strong>{formatYen(costSummary.selfInvestment)}</strong>
              </div>
            </div>

            <div className="hero-cost-footer">
              <span>金額未確定 {costSummary.unknownCount}件を除く</span>
              <a href="#costs">
                内訳を見る <AppIcon name="arrow" />
              </a>
            </div>
          </article>
        </section>

        <section className="metrics-grid" aria-label="現在の概要">
          <MetricCard
            label="活動ステータス"
            value={latestEntry?.phase ?? '—'}
            detail={latestEntry?.event ?? '記録なし'}
            tone="green"
          />
          <MetricCard
            label="申し受け"
            value={`${offerEntries.length}件`}
            detail={`${answeredOfferCount}件回答済・${pendingOfferCount}件保留`}
            tone="coral"
          />
          <MetricCard
            label="婚活直接費"
            value={formatYen(costSummary.direct)}
            detail="確定している実費"
          />
          <MetricCard
            label="今後の予定"
            value={`${nextActions.length}件`}
            detail="保留・予定を含む"
          />
        </section>

        <section className="overview-grid section-space">
          <article className="panel current-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">CURRENT</p>
                <h2>いまの状況</h2>
              </div>
              <span className="panel-icon coral"><AppIcon name="spark" /></span>
            </div>
            {latestEntry ? (
              <div className="current-content">
                <div className="current-date">
                  <time dateTime={latestEntry.date}>{formatDate(latestEntry.date)}</time>
                  <StatusBadge status={latestEntry.status} />
                </div>
                <h3>{latestEntry.event}</h3>
                <p>{latestEntry.note || '補足情報はありません。'}</p>
                {(pendingOfferCount > 0 || unconfirmedOfferCount > 0) && (
                  <div className="attention-note">
                    <span aria-hidden="true">!</span>
                    <p>
                      {pendingOfferCount > 0 && `${pendingOfferCount}件が保留中です。`}
                      {unconfirmedOfferCount > 0 && `${unconfirmedOfferCount}件は対応状況が未確認です。`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p>活動記録はまだありません。</p>
            )}
          </article>

          <article className="panel schedule-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">NEXT</p>
                <h2>次の予定</h2>
              </div>
              <span className="panel-icon green"><AppIcon name="calendar" /></span>
            </div>
            <div className="schedule-list">
              {nextActions.length ? (
                nextActions.map((action, index) => (
                  <div className="schedule-row" key={`${action.date}-${action.title}-${index}`}>
                    <div className="schedule-date">
                      <strong>{action.date ? parseLocalDate(action.date).getDate() : '—'}</strong>
                      <span>{action.date ? `${parseLocalDate(action.date).getMonth() + 1}月` : '未定'}</span>
                    </div>
                    <div className="schedule-copy">
                      <span>{action.meta}</span>
                      <h3>{action.title}</h3>
                    </div>
                    <StatusBadge status={action.status} />
                  </div>
                ))
              ) : (
                <p className="empty-copy">現在、予定として登録された項目はありません。</p>
              )}
            </div>
          </article>
        </section>

        <section className="section-space" id="timeline">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">JOURNEY</p>
              <h2>活動タイムライン</h2>
              <p>上から下へ、準備開始から現在までを時系列で表示。</p>
            </div>
            <span className="record-count">{data.timeline.length} records</span>
          </div>
          <article className="panel timeline-panel">
            <Timeline entries={data.timeline} />
          </article>
        </section>

        <section className="section-space" id="costs">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">INVESTMENT</p>
              <h2>費用の全体像</h2>
              <p>婚活の直接費と、将来にも価値が残る自己投資を分けて表示。</p>
            </div>
            <span className="panel-icon sand"><AppIcon name="coin" /></span>
          </div>

          <div className="cost-overview-grid">
            <article className="panel cost-total-panel">
              <p className="cost-total-label">記録済み支出</p>
              <strong className="cost-total">{formatYen(costTotal)}</strong>
              <p className="cost-total-note">婚活直接費と自己投資の合計</p>

              <div className="cost-bar" aria-label="費用の構成比">
                <span className="bar-direct" style={{ width: `${directRatio}%` }} />
                <span className="bar-self" style={{ width: `${selfRatio}%` }} />
              </div>
              <div className="cost-legend">
                <div>
                  <span className="legend-dot direct" />
                  <p>婚活直接費</p>
                  <strong>{formatYen(costSummary.direct)}</strong>
                </div>
                <div>
                  <span className="legend-dot self" />
                  <p>自己投資</p>
                  <strong>{formatYen(costSummary.selfInvestment)}</strong>
                </div>
              </div>
              <div className="cost-footnotes">
                <span>月会費定義 {formatYen(costSummary.recurringUnitPrice)} / 月</span>
                <span>金額未確定 {costSummary.unknownCount}件</span>
              </div>
            </article>

            <article className="panel category-panel">
              <div className="category-heading">
                <div>
                  <p className="section-kicker">BREAKDOWN</p>
                  <h3>直接費の内訳</h3>
                </div>
                <span>{formatYen(costSummary.direct)}</span>
              </div>
              <div className="category-list">
                {directCategories.map(([category, amount]) => (
                  <div className="category-row" key={category}>
                    <div>
                      <span>{category}</span>
                      <strong>{formatYen(amount)}</strong>
                    </div>
                    <div className="category-track">
                      <span style={{ width: `${costSummary.direct ? (amount / costSummary.direct) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="section-space records-section">
          <div className="section-heading-row compact-heading">
            <div>
              <p className="section-kicker">ALL RECORDS</p>
              <h2>費用明細</h2>
            </div>
            <span className="record-count">{data.costs.length} records</span>
          </div>
          <article className="panel records-panel">
            <CostTable costs={data.costs} />
          </article>
        </section>
      </main>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark">E</span>
          <p><strong>Enlog</strong><br />事実を、あとから振り返れる形に。</p>
        </div>
        <p>Data source: data/*.tsv · Read only viewer</p>
      </footer>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const reload = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true)
    setError(null)
    try {
      setData(await loadDashboardData(signal))
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'データを読み込めませんでした。')
    } finally {
      if (!signal?.aborted) setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  if (!data && !error) {
    return (
      <div className="loading-screen">
        <span className="loading-mark">E</span>
        <p>活動ログを読み込んでいます</p>
      </div>
    )
  }

  if (!data && error) {
    return (
      <div className="error-screen">
        <p className="section-kicker">LOAD ERROR</p>
        <h1>データを読み込めませんでした</h1>
        <p>{error}</p>
        <button type="button" onClick={() => void reload()}>
          <AppIcon name="refresh" /> 再試行
        </button>
      </div>
    )
  }

  return <Dashboard data={data!} onReload={() => void reload()} isRefreshing={isRefreshing} />
}
