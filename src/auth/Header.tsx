import { useFilterExit } from '../wheel/filterExit'

export type Screen =
  | 'wheel'
  | 'recommended'
  | 'together'
  | 'watched-together'
  | 'stats'
  | 'import'
  | 'settings'

interface HeaderProps {
  screen: Screen
  // Owned by the shell so a rename in settings shows here immediately,
  // rather than each screen fetching its own copy.
  displayName: string | null
  unseenRecommendations: number
  onNavigate: (screen: Screen) => void
}

const NAV: { value: Screen; label: string }[] = [
  { value: 'wheel', label: 'Wheel' },
  { value: 'recommended', label: 'For me' },
  { value: 'together', label: 'Together' },
  { value: 'watched-together', label: 'Watched' },
  { value: 'stats', label: 'Stats' },
]

export function Header({ screen, displayName, unseenRecommendations, onNavigate }: HeaderProps) {
  // Set while Filters is open: the way back to the wheel, leaving the
  // filters exactly as they were.
  const exitFilters = useFilterExit()

  return (
    <header className="app-header">
      <div className="app-header-top">
        {exitFilters && screen === 'wheel' ? (
          <button type="button" className="app-header-back" onClick={exitFilters}>
            <span aria-hidden="true">‹</span> Wheel
          </button>
        ) : (
          <span className="app-header-name">{displayName ?? '…'}</span>
        )}
        <button
          type="button"
          className={`app-header-signout${screen === 'settings' ? ' app-nav-item-on' : ''}`}
          aria-current={screen === 'settings' ? 'page' : undefined}
          onClick={() => onNavigate('settings')}
        >
          Settings
        </button>
      </div>

      <nav className="app-nav" aria-label="Screens">
        {NAV.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`app-nav-item${screen === item.value ? ' app-nav-item-on' : ''}`}
            aria-current={screen === item.value ? 'page' : undefined}
            onClick={() =>
              // The Wheel tab while in Filters is the same way out.
              item.value === 'wheel' && exitFilters ? exitFilters() : onNavigate(item.value)
            }
          >
            {item.label}
            {item.value === 'recommended' && unseenRecommendations > 0 && (
              <span className="app-nav-badge" aria-label={`${unseenRecommendations} unopened`}>
                {unseenRecommendations}
              </span>
            )}
          </button>
        ))}
      </nav>
    </header>
  )
}
