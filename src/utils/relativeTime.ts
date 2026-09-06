export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  const diffSeconds = Math.round((now - then) / 1000)

  if (diffSeconds < 60) return 'just now'

  const diffMinutes = Math.round(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`

  const diffYears = Math.round(diffMonths / 12)
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
}
