import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'

interface HeaderProps {
  screen: 'wheel' | 'import'
  onToggleScreen: () => void
}

export function Header({ screen, onToggleScreen }: HeaderProps) {
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
      <span className="app-header-name">{displayName ?? '…'}</span>
      <div className="app-header-actions">
        <button type="button" className="app-header-signout" onClick={onToggleScreen}>
          {screen === 'wheel' ? 'Import' : 'Wheel'}
        </button>
        <button type="button" className="app-header-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
