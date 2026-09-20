import { Empty, Row, Rows, Screen, ScreenHead } from '../ui/Screen'
import type { TogetherMode } from '../wheel/filters'

interface TogetherChooserProps {
  partnerId: string | null
  partnerName: string | null
  sharedCount: number | null
  onChoose: (mode: TogetherMode) => void
  // The shared list still needs somewhere to be added to.
  onEditSharedList: () => void
}

/**
 * A chooser, not a list. Picking one of these builds the wheel and goes
 * straight to it — deciding how to fill a wheel and then having to
 * navigate to it is two steps for one intention.
 */
export function TogetherChooser({
  partnerId,
  partnerName,
  sharedCount,
  onChoose,
  onEditSharedList,
}: TogetherChooserProps) {
  if (!partnerId) {
    return (
      <Screen>
        <ScreenHead title="Together" />
        <Empty art="raccoon">No partner is linked to this account, so there is nobody to watch with.</Empty>
      </Screen>
    )
  }

  const them = partnerName ?? 'them'
  const options: { mode: TogetherMode; name: string; meta: string }[] = [
    {
      mode: 'ours',
      name: 'Our list',
      meta:
        sharedCount === null
          ? 'The films you have both added'
          : `${sharedCount} film${sharedCount === 1 ? '' : 's'} you have both added`,
    },
    { mode: 'theirs', name: `From ${them}'s watchlist`, meta: 'Something they are waiting on' },
    { mode: 'mix', name: 'Mix', meta: 'Half each, drawn from both watchlists' },
  ]

  return (
    <Screen>
      <ScreenHead title="Together" />

      <Rows>
        {options.map((option) => (
          <Row
            key={option.mode}
            name={option.name}
            meta={option.meta}
            onOpen={() => onChoose(option.mode)}
          />
        ))}
      </Rows>

      <button type="button" className="btn-field" onClick={onEditSharedList}>
        Add to our list
      </button>
    </Screen>
  )
}
