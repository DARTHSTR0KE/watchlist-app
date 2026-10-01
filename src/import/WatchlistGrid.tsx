import { useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { removeFromWatchlist, watchFilmNow } from './watchlistWrites'
import type { WatchlistGridItem } from './watchlistWrites'
import { FilmDetailModal } from '../film/FilmDetailModal'

interface WatchlistGridProps {
  userId: string
  items: WatchlistGridItem[]
  // A film has left the watchlist from its detail sheet.
  onGone: (filmId: string) => void
}

export function WatchlistGrid({ userId, items, onGone }: WatchlistGridProps) {
  const [open, setOpen] = useState<WatchlistGridItem | null>(null)

  return (
    <section className="watchlist-grid-section">
      <p className="watchlist-grid-count">
        {items.length} title{items.length === 1 ? '' : 's'} on your watchlist
      </p>
      <div className="watchlist-grid">
        {items.map((item) => {
          const posterUrl = buildPosterUrl(item.posterPath)
          return (
            <button
              type="button"
              className="watchlist-grid-item watchlist-grid-open"
              key={item.itemId}
              title={item.title}
              onClick={() => setOpen(item)}
              aria-label={`Open ${item.title}`}
            >
              {posterUrl ? (
                <img className="watchlist-grid-poster" src={posterUrl} alt={item.title} />
              ) : (
                <div className="watchlist-grid-poster watchlist-grid-poster-fallback">{item.title}</div>
              )}
            </button>
          )
        })}
      </div>

      {/* The same sheet and actions as the Watchlist tab. */}
      {open && (
        <FilmDetailModal
          film={open}
          context="watchlist"
          handlers={{
            watch: async () => {
              await watchFilmNow(userId, open.filmId)
              onGone(open.filmId)
            },
            'remove-watchlist': async () => {
              await removeFromWatchlist(userId, open.filmId)
              onGone(open.filmId)
            },
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}
