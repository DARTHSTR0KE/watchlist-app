import { useEffect, useState } from 'react'
import { languageLabel, starLabel } from '../wheel/filters'
import { Figure, RatingHistogram, StatEmpty, StatSection, TallyBars } from './StatBits'
import {
  computeTogether,
  computeViewing,
  computeWatchlist,
  computeWheel,
  loadStatsRaw,
} from './statsData'
import type { StatsRaw } from './statsData'

interface StatsScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string
}

function round(value: number, places = 1): string {
  return value.toFixed(places).replace(/\.0$/, '')
}

function monthsPhrase(months: number): string {
  if (months < 1) return 'under a month'
  if (months < 24) return `${Math.round(months)} months`
  return `${round(months / 12)} years`
}

export function StatsScreen({ userId, partnerId, partnerName }: StatsScreenProps) {
  const [raw, setRaw] = useState<StatsRaw | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadStatsRaw(userId, partnerId)
      .then((data) => {
        if (cancelled) return
        setRaw(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  if (loading) return null
  if (failed || !raw) {
    return (
      <div className="list-screen">
        <h2 className="list-screen-title">Stats</h2>
        <StatEmpty>Couldn't load your stats. Check your connection and try again.</StatEmpty>
      </div>
    )
  }

  const viewing = computeViewing(raw, languageLabel)
  const together = computeTogether(raw, userId, partnerId, partnerName)
  const wheel = computeWheel(raw)
  const watchlist = computeWatchlist(raw)

  const recommenderLine = (() => {
    if (!partnerId) return null
    if (together.betterRecommender === null) {
      return `Not enough rated recommendations yet to say who picks better for whom.`
    }
    if (together.betterRecommender === 'tie') return 'Too close to call — you recommend about as well as each other.'
    return together.betterRecommender === 'me'
      ? `You are the better recommender.`
      : `${partnerName} is the better recommender.`
  })()

  return (
    <div className="list-screen">
      <h2 className="list-screen-title">Stats</h2>

      {/* ---------------- Viewing ---------------- */}
      <StatSection title="Viewing">
        {raw.mine.length === 0 ? (
          <StatEmpty>
            Nothing watched yet. Import your Letterboxd history, or log a film with Watch this.
          </StatEmpty>
        ) : (
          <>
            <div className="figure-row">
              <Figure value={viewing.filmCount} label="films" />
              <Figure value={viewing.showCount} label="shows" />
              <Figure value={round(viewing.filmHours, 0)} label="hours of film" />
            </div>
            <p className="stat-note">
              Hours count films only — a show's runtime is one episode, not a season.
            </p>

            <div className="figure-row">
              <Figure
                value={viewing.togetherCount}
                label={partnerId ? `with ${partnerName}` : 'watched together'}
              />
              <Figure value={viewing.aloneCount} label="on your own" />
            </div>

            {viewing.ratedCount === 0 ? (
              <StatEmpty>
                No ratings yet. Rate something when you log it and the spread shows up here.
              </StatEmpty>
            ) : (
              <>
                <h4 className="stat-subtitle">My ratings</h4>
                <RatingHistogram data={viewing.ratingHistogram} />
                <div className="figure-row">
                  <Figure
                    value={viewing.myAverage === null ? '—' : `★ ${round(viewing.myAverage, 2)}`}
                    label="your average"
                  />
                  {/* No partner means no second average to sit beside it —
                      naming one would invent a comparison. */}
                  {partnerId && (
                    <Figure
                      value={
                        viewing.theirAverage === null ? '—' : `★ ${round(viewing.theirAverage, 2)}`
                      }
                      label={`${partnerName}'s average`}
                    />
                  )}
                </div>
              </>
            )}

            {viewing.genres.length > 0 && (
              <>
                <h4 className="stat-subtitle">Genres</h4>
                <TallyBars data={viewing.genres} />
              </>
            )}
            {viewing.languages.length > 0 && (
              <>
                <h4 className="stat-subtitle">Languages</h4>
                <TallyBars data={viewing.languages} />
              </>
            )}
            {viewing.decades.length > 0 && (
              <>
                <h4 className="stat-subtitle">Decades</h4>
                <TallyBars data={viewing.decades} />
              </>
            )}
          </>
        )}
      </StatSection>

      {/* ---------------- The two of us ---------------- */}
      <StatSection title="The two of us">
        {!partnerId ? (
          <StatEmpty>
            No partner is linked to this account, so there is nothing to compare against.
          </StatEmpty>
        ) : (
          <>
            {together.bothRatedCount === 0 ? (
              <StatEmpty>
                Nothing you have both rated yet. Once you have each scored the same film, your
                agreement shows up here.
              </StatEmpty>
            ) : (
              <>
                <div className="figure-row">
                  <Figure value={together.bothRatedCount} label="both rated" />
                  <Figure
                    value={
                      together.averageGap === null ? '—' : `${round(together.averageGap, 2)}★`
                    }
                    label="average gap"
                  />
                  <Figure value={together.agreeWithinHalf} label="within half a star" />
                </div>

                <h4 className="stat-subtitle">Most disagreed about</h4>
                <ul className="disagree-list">
                  {together.disagreements.map((entry) => (
                    <li className="disagree-row" key={entry.filmId}>
                      <span className="disagree-title">{entry.title}</span>
                      <div className="disagree-scores">
                        <span className="disagree-score">
                          <span className="score-who">You</span>
                          <span className="score-value">★ {starLabel(entry.mine)}</span>
                        </span>
                        <span className="disagree-gap">{round(entry.gap, 1)}★ apart</span>
                        <span className="disagree-score">
                          <span className="score-who">{partnerName}</span>
                          <span className="score-value">★ {starLabel(entry.theirs)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h4 className="stat-subtitle">Recommendations</h4>
            {together.myRecommending.sent === 0 && together.theirRecommending.sent === 0 ? (
              <StatEmpty>
                Neither of you has recommended anything yet. Use Recommend on a film to start.
              </StatEmpty>
            ) : (
              <>
                <div className="figure-row">
                  <Figure
                    value={`${together.myRecommending.watched}/${together.myRecommending.sent}`}
                    label={`yours ${partnerName} watched`}
                  />
                  <Figure
                    value={
                      together.myRecommending.average === null
                        ? '—'
                        : `★ ${round(together.myRecommending.average, 2)}`
                    }
                    label="what they averaged"
                  />
                </div>
                <div className="figure-row">
                  <Figure
                    value={`${together.theirRecommending.watched}/${together.theirRecommending.sent}`}
                    label="theirs you watched"
                  />
                  <Figure
                    value={
                      together.theirRecommending.average === null
                        ? '—'
                        : `★ ${round(together.theirRecommending.average, 2)}`
                    }
                    label="what you averaged"
                  />
                </div>
                {recommenderLine && <p className="stat-verdict">{recommenderLine}</p>}
              </>
            )}

            <h4 className="stat-subtitle">Who picks</h4>
            {together.picks.length === 0 ? (
              <StatEmpty>
                No picks recorded yet. Logging a watch records who chose it.
              </StatEmpty>
            ) : (
              <TallyBars data={together.picks} highlightMax />
            )}
          </>
        )}
      </StatSection>

      {/* ---------------- The wheel ---------------- */}
      <StatSection title="The wheel">
        {wheel.totalSpins === 0 ? (
          <StatEmpty>No spins yet. Spin the wheel and this fills in.</StatEmpty>
        ) : (
          <>
            <div className="figure-row">
              <Figure value={wheel.totalSpins} label="spins" />
              <Figure value={wheel.watchedSpins} label="ended in a watch" />
              <Figure
                value={wheel.averageRerolls === null ? '—' : round(wheel.averageRerolls, 1)}
                label="rerolls before committing"
              />
            </div>

            {wheel.mostDodged && (
              <div className="dodged">
                <span className="figure-label">Most Dodged</span>
                <span className="dodged-title">{wheel.mostDodged.title}</span>
                <span className="figure-label">
                  rerolled away {wheel.mostDodged.count}{' '}
                  {wheel.mostDodged.count === 1 ? 'time' : 'times'}
                </span>
              </div>
            )}

            {wheel.filterUse.length > 0 && (
              <>
                <h4 className="stat-subtitle">Filters you use</h4>
                <TallyBars data={wheel.filterUse} />
              </>
            )}

            <h4 className="stat-subtitle">Presets you use</h4>
            {wheel.presetUse.length === 0 ? (
              <StatEmpty>
                No spins match a saved preset. Presets are matched by their filters, so editing one
                loses the trail to its earlier spins.
              </StatEmpty>
            ) : (
              <TallyBars data={wheel.presetUse} />
            )}
          </>
        )}
      </StatSection>

      {/* ---------------- The watchlist ---------------- */}
      <StatSection title="The watchlist">
        {watchlist.total === 0 ? (
          <StatEmpty>Your watchlist is empty. Import your Letterboxd export to fill it.</StatEmpty>
        ) : (
          <>
            <div className="figure-row">
              <Figure value={watchlist.total} label="on the list" />
              <Figure value={round(watchlist.addedPerMonth)} label="added per month" />
              <Figure value={round(watchlist.watchedPerMonth)} label="watched per month" />
            </div>

            <p className="stat-verdict">
              {watchlist.monthsToClear === null
                ? 'At this rate the list never clears — you add at least as fast as you watch.'
                : `At this rate it clears in ${monthsPhrase(watchlist.monthsToClear)}.`}
            </p>

            <div className="figure-row">
              <Figure value={watchlist.neverLanded} label="never landed on by a spin" wide />
            </div>
            <p className="stat-note">
              Spins record the film the wheel landed on, not the others it showed, so this counts
              titles a spin has never chosen.
            </p>

            <h4 className="stat-subtitle">Longest waiting</h4>
            {watchlist.oldest.length === 0 ? (
              <StatEmpty>Nothing has been waiting — every title here has been watched.</StatEmpty>
            ) : (
              <ul className="disagree-list">
                {watchlist.oldest.map((entry) => (
                  <li className="waiting-row" key={entry.title + entry.addedAt}>
                    <span className="disagree-title">{entry.title}</span>
                    <span className="figure-label">{monthsPhrase(entry.months)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </StatSection>
    </div>
  )
}
