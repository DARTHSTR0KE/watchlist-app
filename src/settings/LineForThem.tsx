import { useEffect, useState } from 'react'
import { SectionLabel } from '../ui/Screen'
import { SplashLineEditor } from '../social/SplashLineEditor'
import { loadLineFromMe } from '../social/splashLines'
import type { SplashLine } from '../social/splashLines'
import { describeError } from '../lib/dbError'
import { agree, subjectName } from '../utils/names'

// Their splash line, changeable here as soon as the month allows rather
// than only when the prompt comes round.
export function LineForThem({
  userId,
  partnerId,
  partnerName,
}: {
  userId: string
  partnerId: string
  partnerName: string | null
}) {
  const them = partnerName ?? 'Them'
  // Undefined while loading; null when I have never written one.
  const [current, setCurrent] = useState<SplashLine | null | undefined>(undefined)
  // The database's own account of why the read failed, not a stand-in.
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadLineFromMe(userId, partnerId)
      .then((line) => {
        if (!cancelled) setCurrent(line)
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(describeError(error))
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  return (
    <section>
      <SectionLabel tone="sage">{them}</SectionLabel>
      <p className="screen-empty">
        What {subjectName(partnerName)} {agree(partnerName, 'sees', 'see')} under the name when
        they open this.
      </p>
      {failure ? (
        <p className="screen-empty">Couldn't load the line you wrote: {failure}</p>
      ) : current === undefined ? (
        <p className="screen-empty">Loading…</p>
      ) : (
        <SplashLineEditor
          // Remounted on save so the editor picks up the new line and lock.
          key={current?.setAt ?? 'none'}
          userId={userId}
          partnerId={partnerId}
          current={current}
          variant="settings"
          onSaved={setCurrent}
        />
      )}
    </section>
  )
}
