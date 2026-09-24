import type { ReactNode } from 'react'

/**
 * The top of every screen: a ticket. Cream paper, a notch bitten out of
 * each side, a small heading, one large figure, a quiet line under it and,
 * where it earns one, a perforation with a short line on the stub.
 *
 * It always carries a fact and never a control — nothing on it is tapped.
 */
export function Ticket({
  heading,
  figure,
  line,
  perforation,
}: {
  heading: string
  figure: ReactNode
  line?: ReactNode
  perforation?: ReactNode
}) {
  return (
    <div className="ticket" role="group" aria-label={heading}>
      <div className={`ticket-main${perforation ? ' ticket-main-torn' : ' ticket-whole'}`}>
        <p className="ticket-heading">{heading}</p>
        <p className="ticket-figure">{figure}</p>
        {line && <p className="ticket-line">{line}</p>}
      </div>
      {perforation && (
        <div className="ticket-stub">
          <p className="ticket-perforation">{perforation}</p>
        </div>
      )}
    </div>
  )
}
