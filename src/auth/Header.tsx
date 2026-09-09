import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'

export type Screen = 'wheel' | 'recommended' | 'import'

interface HeaderProps {
  screen: Screen
  unseenRecommendations: number
  onNavigate: (screen: Screen) => void
}

const NAV: { value: Screen; label: string }[] = [
  { value: 'wheel', label: 'Wheel' },
  { value: 'recommended', label: 'For me' },
  { value: 'import', label: 'Import' },
]

export function Header({ screen, unseenRecommendations, onNavigate }: HeaderProps) {
  const { session, signOut } = useAuth()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setDisplayName(data?.display_name ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <header className="app-header">
      <div className="app-header-top">
        <span className="app-header-name">{displayName ?? '…'}</span>
        <button type="button" className="app-header-signout" onClick={signOut}>
          Sign out
        </button>
      </div>

      <nav className="app-nav" aria-label="Screens">
        {NAV.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`app-nav-item${screen === item.value ? ' app-nav-item-on' : ''}`}
            aria-current={screen === item.value ? 'page' : undefined}
            onClick={() => onNavigate(item.value)}
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
