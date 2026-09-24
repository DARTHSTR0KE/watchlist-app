import { useState } from 'react'
import type { ReactNode } from 'react'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { PersonTally, RatedFilm, Tally, YearChoice } from './statsCompute'
import { palette, toneColor } from './palette'
import type { Tone } from './palette'
import { SectionLabel } from '../ui/Screen'
import { buildPosterUrl, buildProfileUrl } from '../wheel/posters'
import { starLabel } from '../wheel/filters'
import { initialsOf } from '../utils/initials'

// A number you can read at arm's length, with a label that doesn't compete
// with it.
export function Figure({ value, label, tone }: { value: ReactNode; label: string; tone?: Tone }) {
  return (
    <div className="figure">
      <span className={`figure-value${tone ? ` tone-${tone}` : ''}`}>{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  )
}

// The same label as every other screen, in the colour of what the section
// is about.
export function StatSection({
  title,
  tone,
  children,
}: {
  title: string
  tone: Tone
  children: ReactNode
}) {
  return (
    <section className="stat-section">
      <SectionLabel tone={tone}>{title}</SectionLabel>
      {children}
    </section>
  )
}

// Every section can be empty, and an empty section has to say what would
// fill it rather than rendering nothing.
export function StatEmpty({ children }: { children: ReactNode }) {
  return <p className="screen-empty">{children}</p>
}

export function StatNote({ children }: { children: ReactNode }) {
  return <p className="stat-note">{children}</p>
}

/**
 * All time, then each year something was watched, newest first. Sticky, so
 * which year you are reading is never scrolled out of sight.
 */
export function YearPicker({
  years,
  value,
  onChange,
}: {
  years: number[]
  value: YearChoice
  onChange: (year: YearChoice) => void
}) {
  const options: YearChoice[] = ['all', ...years]
  return (
    <div className="year-picker" role="tablist" aria-label="Which year">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={option === value}
          className={`year-chip${option === value ? ' year-chip-on' : ''}`}
          onClick={() => onChange(option)}
        >
          {option === 'all' ? 'All time' : option}
        </button>
      ))}
    </div>
  )
}

// Circular portraits with a count, scrolling sideways. Initials where TMDB
// has no photo, or the photo fails to load.
export function PeopleRow({ people }: { people: PersonTally[] }) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  return (
    <ul className="people-row">
      {people.map((person) => {
        const url = failed.has(person.name) ? null : buildProfileUrl(person.profilePath)
        return (
          <li className="people-member" key={person.name}>
            <span className="people-photo-wrap">
              {url ? (
                <img
                  className="cast-photo"
                  src={url}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  onError={() => setFailed((current) => new Set(current).add(person.name))}
                />
              ) : (
                <span className="cast-photo cast-photo-fallback" aria-hidden="true">
                  {initialsOf(person.name)}
                </span>
              )}
              <span className="people-count" aria-label={`${person.count} films`}>
                {person.count}
              </span>
            </span>
            <span className="cast-name">{person.name}</span>
          </li>
        )
      })}
    </ul>
  )
}

// Three posters with their rating, framed in the section's colour.
export function PosterTrio({ films, tone }: { films: RatedFilm[]; tone: 'sage' | 'rust' }) {
  return (
    <ul className={`poster-trio poster-trio-${tone}`}>
      {films.map((film) => {
        const url = buildPosterUrl(film.posterPath)
        return (
          <li className="poster-trio-cell" key={film.filmId}>
            {url ? (
              <img className="poster-trio-image" src={url} alt={film.title} loading="lazy" />
            ) : (
              <span className="poster-trio-image poster-trio-empty">{film.title}</span>
            )}
            <span className="poster-trio-rating">★ {starLabel(film.rating)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function CountryPills({ countries }: { countries: Tally[] }) {
  return (
    <ul className="country-pills">
      {countries.map((country) => (
        <li className="country-pill" key={country.label}>
          {country.label}
          <span className="country-pill-count">{country.count}</span>
        </li>
      ))}
    </ul>
  )
}

export function TallyBars({ data, tone }: { data: Tally[]; tone: Tone }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((entry) => entry.count))
  const p = palette()

  return (
    <div className="chart" style={{ height: Math.max(120, data.length * 30) }}>
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
            fill={toneColor(tone)}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: 'right', fill: p.label, fontSize: 12 }}
          />
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
          <Bar dataKey="count" fill={p.amber} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
