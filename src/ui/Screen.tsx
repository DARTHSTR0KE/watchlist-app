import type { ReactNode } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { EmptyArt } from '../brand/EmptyArt'
import type { EmptyArtKind } from '../brand/EmptyArt'
import { BowlMoment } from '../brand/Moments'
import { PeerMoment } from '../brand/Ambient'

/**
 * One pattern, used by every section. Rows for things you manage, grids
 * for films you browse, a heading with a status on the right, and section
 * labels in the colour of what they mean. Nothing here overlays anything.
 */

export function Screen({ children }: { children: ReactNode }) {
  return <div className="screen">{children}</div>
}

// Title left, count or short status right, in the same place everywhere so
// the eye stops hunting for it between screens.
export function ScreenHead({
  title,
  status,
  tone = 'amber',
}: {
  title: string
  status?: ReactNode
  tone?: 'amber' | 'rust'
}) {
  return (
    <div className="screen-head">
      <h2 className="screen-title">{title}</h2>
      {status !== undefined && <span className={`screen-status tone-${tone}`}>{status}</span>}
    </div>
  )
}

// Small caps, letterspaced. Filter dimensions carry their own colour;
// everywhere else is amber.
export function SectionLabel({
  children,
  tone = 'amber',
}: {
  children: ReactNode
  tone?: 'amber' | 'rust' | 'sage' | 'slate' | 'sand' | 'mauve' | 'dimension'
}) {
  return <p className={`section-label tone-${tone}`}>{children}</p>
}

export function PosterThumb({ posterPath, title }: { posterPath: string | null; title?: string }) {
  const url = buildPosterUrl(posterPath)
  return url ? (
    <img className="row-poster" src={url} alt="" aria-hidden="true" />
  ) : (
    <span className="row-poster row-poster-empty" aria-hidden="true">
      {title ? title.slice(0, 1) : ''}
    </span>
  )
}

// Three posters, overlapped, so a collection is recognisable by what is in
// it rather than only by what it was named.
export function PosterStack({ posterPaths }: { posterPaths: string[] }) {
  const slots = posterPaths.slice(0, 3)
  if (slots.length === 0) return <span className="row-stack row-stack-empty" aria-hidden="true" />
  return (
    <span className="row-stack" aria-hidden="true">
      {slots.map((path, index) => (
        <img
          key={path}
          className="row-stack-poster"
          style={{ left: `${index * 13}px`, zIndex: slots.length - index }}
          src={buildPosterUrl(path) ?? undefined}
          alt=""
        />
      ))}
    </span>
  )
}

/**
 * A row for something you manage: art on the left, a name, one line of
 * meta beneath, then either actions or a chevron. Divided by hairlines
 * rather than boxed into cards.
 */
export function Row({
  art,
  name,
  meta,
  actions,
  onOpen,
  children,
}: {
  art?: ReactNode
  name: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  // When given, the row itself is the action and shows a chevron.
  onOpen?: () => void
  // Anything that belongs under the meta line, like a note.
  children?: ReactNode
}) {
  const body = (
    <>
      {art}
      <span className="row-text">
        <span className="row-name">{name}</span>
        {meta !== undefined && <span className="row-meta">{meta}</span>}
      </span>
      {onOpen && <span className="row-chevron" aria-hidden="true" />}
    </>
  )

  return (
    <li className="row">
      {onOpen ? (
        <button type="button" className="row-main row-main-tappable" onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className="row-main">{body}</div>
      )}
      {children}
      {actions && <div className="row-actions">{actions}</div>}
    </li>
  )
}

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="rows">{children}</ul>
}

// Three across, posters only. For films you are looking through rather
// than acting on.
export function PosterGrid({ children }: { children: ReactNode }) {
  return <ul className="poster-grid-3">{children}</ul>
}

export function PosterCell({
  posterPath,
  title,
  marked,
  markLabel,
  onRemove,
  removeLabel,
}: {
  posterPath: string | null
  title: string
  // A small sage star in the corner — one list with a marker beats two.
  marked?: boolean
  markLabel?: string
  onRemove?: () => void
  removeLabel?: string
}) {
  const url = buildPosterUrl(posterPath)
  return (
    <li className="poster-cell-3">
      {url ? (
        <img className="poster-cell-3-image" src={url} alt={title} />
      ) : (
        <span className="poster-cell-3-image poster-cell-3-empty">{title}</span>
      )}
      {marked && (
        <span className="poster-mark" title={markLabel} aria-label={markLabel}>
          ★
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          className="poster-cell-3-remove"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          ×
        </button>
      )}
    </li>
  )
}

/**
 * `art` turns the line into an empty state proper — the drawing sits with
 * the sentence rather than above it. Without it this stays the plain note
 * it has always been, which is what most callers want.
 */
/**
 * A screen-level wait. Only for the waits you actually see — putting this
 * behind every await would flash it for eighty milliseconds and read as a
 * fault rather than as loading.
 */
// Who waits with you. Chosen per screen, so it isn't the same drawing on
// every one: a peek over the edge, or the fish going round its bowl.
export type LoadingArt = 'raccoon' | 'goldfish' | 'bowl'

export function Loading({ children, art = 'bowl' }: { children?: ReactNode; art?: LoadingArt }) {
  return (
    <div className="loading-line">
      {art === 'bowl' ? <BowlMoment mood="swim" size={40} /> : <PeerMoment who={art} />}
      <p className="screen-empty">{children ?? 'Loading…'}</p>
    </div>
  )
}

// Something went wrong: the bowl over, and what it was.
export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <div className="loading-line">
      <BowlMoment mood="tipped" size={40} />
      <p className="screen-empty">{children}</p>
    </div>
  )
}

export function Empty({ children, art }: { children: ReactNode; art?: EmptyArtKind }) {
  if (!art) return <p className="screen-empty">{children}</p>
  return (
    <div className="screen-empty screen-empty-art">
      <EmptyArt kind={art} />
      <p className="screen-empty-words">{children}</p>
    </div>
  )
}
