import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { DEFAULT_TAGLINE, cacheLineFor, cachedLineFor, loadLineForMe } from '../social/splashLines'
import { reportQuietly } from '../lib/dbError'

/**
 * The tagline the other person wrote for me, or the original when they
 * haven't. While it is still being fetched the last one seen stands in,
 * and with nothing seen yet the line stays empty rather than showing the
 * default only to swap it out a moment later.
 */
export function useLineForMe(): string {
  const { session, loading } = useAuth()
  const userId = session?.user.id ?? null
  // Undefined while the fetch is in the air; null once it says there is
  // no line.
  const [fetched, setFetched] = useState<{ userId: string; line: string | null } | undefined>()

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void loadLineForMe(userId)
      .then((line) => {
        if (cancelled) return
        cacheLineFor(userId, line)
        setFetched({ userId, line })
      })
      .catch((error: unknown) => {
        // A failed read shows whatever was cached, or the default — the
        // splash is no place for an error — but the reason is kept.
        reportQuietly('Reading your splash line', error)
        if (!cancelled) setFetched({ userId, line: cachedLineFor(userId) })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) return ''
  if (!userId) return DEFAULT_TAGLINE
  if (fetched?.userId === userId) return fetched.line ?? DEFAULT_TAGLINE
  return cachedLineFor(userId) ?? ''
}
