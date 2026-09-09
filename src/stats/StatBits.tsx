import type { ReactNode } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { Tally } from './statsData'
import { categoryColors, palette } from './palette'

// A number you can read at arm's length, with a label that doesn't compete
// with it.
export function Figure({
  value,
  label,
  wide,
  tone,
}: {
  value: ReactNode
  label: string
  wide?: boolean
  // Whose number this is, when it sits beside the other person's.
  tone?: 'me' | 'them'
}) {
  return (
    <div className={`figure${wide ? ' figure-wide' : ''}`}>
      <span className={`figure-value${tone ? ` figure-value-${tone}` : ''}`}>{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  )
}

export function StatSection({ title, children }: { title: string; children: ReactNode }) {
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

export function TallyBars({
  data,
  colors,
  height,
}: {
  data: Tally[]
  // One per row. Defaults to the categorical cycle.
  colors?: string[]
  height?: number
}) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((entry) => entry.count))
  const fills = colors ?? categoryColors(data.length)
  const p = palette()

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
            tick={{ fill: p.axis, fontSize: 12 }}
          />
          {/* Drawn at full size straight away. The grow-in animation runs on
              requestAnimationFrame, so anywhere that is throttled — a
              background tab, a low-power webview — would leave a bar
              stopped partway and reading as a smaller number. */}
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: 'right', fill: p.label, fontSize: 12 }}
          >
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={fills[index % fills.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RatingHistogram({ data }: { data: { rating: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((entry) => entry.count))
  const p = palette()

  return (
    <div className="chart" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="rating"
            tickLine={false}
            axisLine={false}
            tick={{ fill: p.label, fontSize: 11 }}
          />
          <YAxis hide domain={[0, max]} />
          {/* These are my ratings, so they take my colour. */}
          <Bar dataKey="count" fill={p.me} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
