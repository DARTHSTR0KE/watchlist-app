import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FilmSheet } from '../wheel/FilmSheet'
import type { WheelItem } from '../wheel/titles'
import { prefersReducedMotion } from '../brand/coldStart'
import { letterboxdUrlFor } from '../social/letterboxdLink'
import { loadFilmDetail } from './filmDetail'
import type { FilmDetail } from './filmDetail'
import { ACTION_LABEL, actionsFor, offersLetterboxd } from './filmActions'
import type { FilmActionKind, FilmContext } from './filmActions'

// What the list already knows, shown at once while the rest loads.
export interface FilmPreview {
  filmId: string
  title: string
  posterPath: string | null
}

interface FilmDetailModalProps {
  film: FilmPreview
  context: FilmContext
  // One per action this context offers. An action that resolves closes the
  // sheet; one that throws keeps it open and says it didn't work.
  handlers?: Partial<Record<FilmActionKind, () => Promise<void>>>
  onClose: () => void
}

function previewItem(film: FilmPreview): WheelItem {
  return {
    id: film.filmId,
    title: film.title,
    posterPath: film.posterPath,
    backdropPath: null,
    year: 0,
    runtimeMinutes: 0,
    genres: [],
    rating: 0,
    synopsis: '',
    trailerKey: null,
    // [] rather than null: nothing is fetched for a film still loading.
    topCast: [],
    mediaType: film.filmId.startsWith('tv:') ? 'tv' : 'movie',
    originalLanguage: null,
    addedAt: null,
  }
}

/** Any poster, opened: the wheel's sheet with this screen's actions. */
export function FilmDetailModal({ film, context, handlers = {}, onClose }: FilmDetailModalProps) {
  const [detail, setDetail] = useState<FilmDetail | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState<FilmActionKind | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadFilmDetail(film.filmId)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [film.filmId])

  const actions = actionsFor(context).filter((kind) => handlers[kind])
  const run = async (kind: FilmActionKind) => {
    const handler = handlers[kind]
    if (!handler) return
    setBusy(kind)
    setProblem(null)
    try {
      await handler()
      onClose()
    } catch {
      setProblem(`That didn't work. "${film.title}" is as it was.`)
      setBusy(null)
    }
  }

  const status = problem ?? (detail ? null : loadFailed ? "The details couldn't be loaded." : 'Loading the details…')

  // Drawn at the top of the page, not inside the screen that opened it:
  // each screen is its own layer, and the TMDB credit footer sits above it,
  // so a sheet left inside a screen had its lower buttons covered.
  return createPortal(
    <FilmSheet
      // Keyed so the sheet starts over, with the cast fetch, once the full
      // film replaces the preview.
      key={detail ? 'detail' : 'preview'}
      item={detail ?? previewItem(film)}
      reduceMotion={prefersReducedMotion()}
      onDismiss={onClose}
      status={status}
    >
      {actions.map((kind, index) => (
        <button
          key={kind}
          type="button"
          className={`action-button${index === 0 ? ' primary' : ''}`}
          disabled={busy !== null}
          onClick={() => void run(kind)}
        >
          {busy === kind ? 'Working…' : ACTION_LABEL[kind]}
        </button>
      ))}
      {offersLetterboxd(context) && (
        <a
          className="action-button"
          href={letterboxdUrlFor({
            filmId: film.filmId,
            title: detail?.title ?? film.title,
            letterboxdUri: detail?.letterboxdUri ?? null,
          })}
          target="_blank"
          rel="noreferrer"
        >
          Open on Letterboxd
        </a>
      )}
      {actions.length === 0 && (
        <button type="button" className="action-button" onClick={onClose}>
          Close
        </button>
      )}
    </FilmSheet>,
    document.body,
  )
}
