import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { languageLabel, starLabel } from '../wheel/filters'
import {
  CountryPills,
  Figure,
  PeopleRow,
  PosterTrio,
  RatingHistogram,
  StatEmpty,
  StatNote,
  StatSection,
  TallyBars,
  YearPicker,
} from './StatBits'
import { ErrorLine, Loading, Screen, ScreenHead } from '../ui/Screen'
import { loadStatsRaw } from './statsData'
import { describeError } from '../lib/dbError'
import { computeStats, watchedYears } from './statsCompute'
import type { Coverage, StatsRaw, YearChoice } from './statsCompute'

interface StatsScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

function countryLabel(code: string): string {
  try {
    return REGION_NAMES.of(code) ?? code
  } catch {
    return code
  }
}

function round(value: number, places = 1): string {
  return value.toFixed(places).replace(/\.0+$/, '')
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

const REFRESH_HINT = 'Refresh film data in Settings fills them in.'

/**
 * Cast, directors and countries only exist once Refresh film data has run
 * over a film. When none of the films in range have them, that is what
 * gets said — a zero would claim you had watched no one.
 */
function CoverageGate({
  coverage,
  what,
  hasAny,
  empty,
  children,
}: {
  coverage: Coverage
  // Plural noun: "cast", "directors", "countries".
  what: string
  hasAny: boolean
  empty: string
  children: ReactNode
}) {
  if (coverage.known === 0 && coverage.missing === 0) return <StatEmpty>{empty}</StatEmpty>
  if (coverage.known === 0) {
    return (
      <StatEmpty>
        No {what} fetched for these films yet. {REFRESH_HINT}
      </StatEmpty>
    )
  }
  return (
    <>
      {hasAny ? children : <StatEmpty>{empty}</StatEmpty>}
      {coverage.missing > 0 && (
        <StatNote>
          {plural(coverage.missing, 'film')} still missing {what}. {REFRESH_HINT}
        </StatNote>
      )}
    </>
  )
}

export function StatsScreen({ userId, partnerId, partnerName }: StatsScreenProps) {
  // Every label below reads the live name; this only covers an unreadable
  // profile row, and is a pronoun rather than a name.
  const them = partnerName ?? 'them'
  const [raw, setRaw] = useState<StatsRaw | null>(null)
  const [loading, setLoading] = useState(true)
  // Why the load failed, in the database's words.
  const [failure, setFailure] = useState<string | null>(null)
  const [year, setYear] = useState<YearChoice>('all')

  useEffect(() => {
    let cancelled = false
    void loadStatsRaw(userId, partnerId)
      .then((data) => {
        if (cancelled) return
        setRaw(data)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setFailure(describeError(error))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  const years = useMemo(() => (raw ? watchedYears(raw) : []), [raw])
  const stats = useMemo(
    () =>
      raw ? computeStats(raw, year, { language: languageLabel, country: countryLabel }) : null,
    [raw, year],
  )

  if (loading) {
    return (
      <Screen>
        <ScreenHead title="Stats" />
        <Loading art="raccoon">Adding it all up…</Loading>
      </Screen>
    )
  }
  if (failure || !stats) {
    return (
      <Screen>
        <ScreenHead title="Stats" />
        <ErrorLine>Couldn't load your stats: {failure ?? 'nothing came back.'}</ErrorLine>
      </Screen>
    )
  }

  const when = year === 'all' ? 'yet' : `in ${year}`
  const nothingWatched = stats.watchedCount === 0

  const averagesLine = (() => {
    if (!partnerId) return 'No partner is linked, so there is no average to compare against.'
    if (stats.myAverageShared === null || stats.theirAverageShared === null) {
      return `No film you have both rated ${when}, so there is no average to compare.`
    }
    return `On the ${plural(stats.bothRatedCount, 'film')} you've both rated, you average ★ ${round(stats.myAverageShared, 2)} and ${them} ★ ${round(stats.theirAverageShared, 2)}.`
  })()

  return (
    <Screen>
      <ScreenHead title="Stats" status={`${stats.watchedCount} watched`} />

      <YearPicker years={years} value={year} onChange={setYear} />

      {/* ---------------- Headline ---------------- */}
      {nothingWatched ? (
        <StatEmpty>
          Nothing watched yet. Import your Letterboxd history, or log a film with Watch this.
        </StatEmpty>
      ) : (
        <>
          <div className="figure-row">
            <Figure value={stats.filmCount} label="films" tone="amber" />
            <Figure value={round(stats.filmHours, 0)} label="hours" tone="amber" />
            <Figure
              value={stats.countryCoverage.known === 0 ? '—' : stats.countries.length}
              label="countries"
              tone="slate"
            />
          </div>
          {stats.showCount > 0 && (
            <StatNote>
              Plus {plural(stats.showCount, 'show')}, left out of hours — a show's runtime is one
              episode, not a season.
            </StatNote>
          )}
          {stats.countryCoverage.known === 0 && (
            <StatNote>Countries haven't been fetched for these films yet. {REFRESH_HINT}</StatNote>
          )}
        </>
      )}

      {/* ---------------- People ---------------- */}
      <StatSection title="Most watched actors" tone="amber">
        <CoverageGate
          coverage={stats.actorCoverage}
          what="cast"
          hasAny={stats.actors.length > 0}
          empty={`No actors to count ${when}.`}
        >
          <PeopleRow people={stats.actors} />
        </CoverageGate>
      </StatSection>

      <StatSection title="Most watched directors" tone="amber">
        <CoverageGate
          coverage={stats.directorCoverage}
          what="directors"
          hasAny={stats.directors.length > 0}
          empty={`No directors to count ${when}.`}
        >
          <PeopleRow people={stats.directors} />
        </CoverageGate>
      </StatSection>

      {/* ---------------- Ratings at the ends ---------------- */}
      <StatSection title="You rated highest" tone="sage">
        {stats.highest.length === 0 ? (
          <StatEmpty>Nothing rated {when}. Rate something when you log it.</StatEmpty>
        ) : (
          <PosterTrio films={stats.highest} tone="sage" />
        )}
      </StatSection>

      <StatSection title="And lowest" tone="rust">
        {stats.lowest.length === 0 ? (
          <StatEmpty>
            {stats.ratedCount === 0
              ? `Nothing rated ${when}.`
              : 'Nothing rated lower than the films above.'}
          </StatEmpty>
        ) : (
          <PosterTrio films={stats.lowest} tone="rust" />
        )}
      </StatSection>

      {/* ---------------- Places ---------------- */}
      <StatSection title="Countries" tone="slate">
        <CoverageGate
          coverage={stats.countryCoverage}
          what="countries"
          hasAny={stats.countries.length > 0}
          empty={`No countries to count ${when}.`}
        >
          <CountryPills countries={stats.countries} />
        </CoverageGate>
      </StatSection>

      {/* ---------------- What kind ---------------- */}
      <StatSection title="Genres" tone="mauve">
        {stats.genres.length === 0 ? (
          <StatEmpty>No genres to count {when}.</StatEmpty>
        ) : (
          <TallyBars data={stats.genres} tone="mauve" />
        )}
      </StatSection>

      <StatSection title="Languages" tone="slate">
        {stats.languages.length === 0 ? (
          <StatEmpty>No languages to count {when}.</StatEmpty>
        ) : (
          <TallyBars data={stats.languages} tone="slate" />
        )}
      </StatSection>

      {/* ---------------- The two of us ---------------- */}
      <StatSection title="Together and on your own" tone="sage">
        {nothingWatched ? (
          <StatEmpty>Nothing watched {when}.</StatEmpty>
        ) : (
          <div className="figure-row">
            <Figure
              value={stats.togetherCount}
              label={partnerId ? `with ${them}` : 'together'}
              tone="sage"
            />
            <Figure value={stats.aloneCount} label="on your own" tone="amber" />
            {/* Not folded into "on your own" — nobody has said which. */}
            {stats.unansweredCount > 0 && (
              <Figure value={stats.unansweredCount} label="not answered yet" />
            )}
          </div>
        )}
      </StatSection>

      <StatSection title="Biggest disagreements" tone="rust">
        {!partnerId ? (
          <StatEmpty>No partner is linked, so there is nothing to disagree about.</StatEmpty>
        ) : stats.bothRatedCount === 0 ? (
          <StatEmpty>
            Nothing you have both rated {when}. Only films you watched together can be compared.
          </StatEmpty>
        ) : stats.disagreements.length === 0 ? (
          <StatEmpty>
            You gave the same rating to all {plural(stats.bothRatedCount, 'film')} you've both
            rated.
          </StatEmpty>
        ) : (
          <ul className="disagree-list">
            {stats.disagreements.map((entry) => (
              <li className="disagree-row" key={entry.filmId}>
                <span className="disagree-title">{entry.title}</span>
                <div className="disagree-scores">
                  <span className="disagree-score who-me">
                    <span className="score-who">You</span>
                    <span className="score-value">★ {starLabel(entry.mine)}</span>
                  </span>
                  <span className="disagree-gap">{round(entry.gap, 1)}★ apart</span>
                  <span className="disagree-score who-them">
                    <span className="score-who">{them}</span>
                    <span className="score-value">★ {starLabel(entry.theirs)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </StatSection>

      {/* ---------------- The wheel ---------------- */}
      <StatSection title="The wheel" tone="amber">
        {stats.wheel.totalSpins === 0 ? (
          <StatEmpty>No spins {when}. Spin the wheel and this fills in.</StatEmpty>
        ) : (
          <>
            <div className="figure-row">
              <Figure value={stats.wheel.totalSpins} label="spins" />
              <Figure
                value={
                  stats.wheel.averageRerolls === null ? '—' : round(stats.wheel.averageRerolls, 1)
                }
                label="rerolls before committing"
              />
            </div>
            {stats.wheel.mostDodged ? (
              <div className="dodged">
                <span className="figure-label">Most dodged</span>
                <span className="dodged-title">{stats.wheel.mostDodged.title}</span>
                <span className="figure-label">
                  rerolled away {stats.wheel.mostDodged.count}{' '}
                  {stats.wheel.mostDodged.count === 1 ? 'time' : 'times'}
                </span>
              </div>
            ) : (
              <StatNote>Nothing rerolled away {when}.</StatNote>
            )}
          </>
        )}
      </StatSection>

      {/* ---------------- Ratings ---------------- */}
      <StatSection title="Your ratings" tone="amber">
        {stats.ratedCount === 0 ? (
          <StatEmpty>No ratings {when}. Rate something when you log it.</StatEmpty>
        ) : (
          <RatingHistogram data={stats.ratingHistogram} />
        )}
        <p className="stat-verdict">{averagesLine}</p>
      </StatSection>
    </Screen>
  )
}
