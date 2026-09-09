import type { ReactNode } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { Tally } from './statsData'

// A number you can read at arm's length, with a label that doesn't compete
// with it.
export function Figure({
  value,
  label,
  wide,
}: {
  value: ReactNode
  label: string
  wide?: boolean
}) {
  return (
    <div className={`figure${wide ? ' figure-wide' : ''}`}>
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  )
}

export function StatSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="stat-section">
      <h3 className="stat-section-title">{title}</h3>
      {children}
    </section>
  )
}

// Every section can be empty on a new account, and an empty section has to
// say what would fill it rather than rendering nothing.
export function StatEmpty({ children }: { children: ReactNode }) {
  return <p className="stat-empty">{children}</p>
}

const BAR = '#e8c15c'
const BAR_MUTED = '#4a4a55'

export function TallyBars({
  data,
  highlightMax,
  height,
}: {
  data: Tally[]
  highlightMax?: boolean
  height?: number
}) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((entry) => entry.count))

  return (
    <div className="chart" style={{ height: height ?? Math.max(120, data.length * 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 34, bottom: 0, left: 0 }}>
          {/* An explicit numeric domain, not 'dataMax': left to itself
              recharts rounds the axis up to a "nice" number well past the
              data, and the longest bar fills a quarter of the track. */}
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#c8c8ce', fontSize: 12 }}
          />
          {/* Drawn at full size straight away. The grow-in animation runs on
              requestAnimationFrame, so anywhere that is throttled — a
              background tab, a low-power webview — would leave a bar
              stopped partway and reading as a smaller number. */}
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: 'right', fill: '#9a9aa4', fontSize: 12 }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={highlightMax && entry.count < max ? BAR_MUTED : BAR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RatingHistogram({ data }: { data: { rating: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((entry) => entry.count))

  return (
    <div className="chart" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="rating"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#9a9aa4', fontSize: 11 }}
          />
          <YAxis hide domain={[0, max]} />
          <Bar dataKey="count" fill={BAR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
