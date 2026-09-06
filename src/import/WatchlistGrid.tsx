import { buildPosterUrl } from '../wheel/posters'
import type { WatchlistGridItem } from './watchlistWrites'

interface WatchlistGridProps {
  items: WatchlistGridItem[]
}

export function WatchlistGrid({ items }: WatchlistGridProps) {
  return (
    <section className="watchlist-grid-section">
      <p className="watchlist-grid-count">
        {items.length} title{items.length === 1 ? '' : 's'} on your watchlist
      </p>
      <div className="watchlist-grid">
        {items.map((item) => {
          const posterUrl = buildPosterUrl(item.posterPath)
          return (
            <div className="watchlist-grid-item" key={item.itemId} title={item.title}>
              {posterUrl ? (
                <img className="watchlist-grid-poster" src={posterUrl} alt={item.title} />
              ) : (
                <div className="watchlist-grid-poster watchlist-grid-poster-fallback">{item.title}</div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
