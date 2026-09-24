import { useEffect } from 'react'
import { Row, Rows, SectionLabel } from '../ui/Screen'
import { countFilmsMissingData, startFilmRefresh, useFilmRefresh } from './filmRefresh'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// Cast, directors and countries for films stored before import fetched
// them. It runs in the background: the screen can be left mid-run.
export function FilmRefresh() {
  const refresh = useFilmRefresh()

  useEffect(() => {
    void countFilmsMissingData()
  }, [])

  const status = (() => {
    if (refresh.running) {
      return refresh.total === 0
        ? 'Finding films to refresh…'
        : `${refresh.completed} of ${refresh.total} done`
    }
    if (refresh.error) return refresh.error
    if (refresh.missing === null) return 'Checking…'
    if (refresh.finished && refresh.failed > 0) {
      return `${plural(refresh.failed, 'film')} couldn't be refreshed. Run it again to retry them.`
    }
    if (refresh.missing === 0) return 'Every film has its cast, directors and countries.'
    return `${plural(refresh.missing, 'film')} missing cast, directors or countries`
  })()

  const percent = refresh.total === 0 ? 0 : (refresh.completed / refresh.total) * 100

  return (
    <section>
      <SectionLabel>Film data</SectionLabel>
      <Rows>
        <Row
          name={status}
          meta={
            refresh.running
              ? 'Keeps going if you leave this screen.'
              : 'Stats uses these for actors, directors and countries.'
          }
        >
          {/* The actual reason, whether it was TMDB or the database. */}
          {refresh.lastFailure && (
            <p className="row-note">Last failure — {refresh.lastFailure}</p>
          )}
        </Row>
      </Rows>
      {refresh.running && refresh.total > 0 && (
        <div
          className="refresh-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={refresh.total}
          aria-valuenow={refresh.completed}
        >
          <span className="refresh-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}
      <button
        type="button"
        className="btn-field"
        disabled={refresh.running || refresh.missing === 0}
        onClick={() => void startFilmRefresh()}
      >
        {refresh.running ? 'Refreshing…' : 'Refresh film data'}
      </button>
    </section>
  )
}
