/** "19:02" today, "Yesterday", weekday within the last week, otherwise "12 Nov". */
export function formatChatTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const daysAgo = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

  if (date >= daysAgo(0)) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (date >= daysAgo(1)) return 'Yesterday'
  if (date >= daysAgo(6)) return date.toLocaleDateString(undefined, { weekday: 'short' })
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** "22:13" */
export function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** "Today at 22:13", "Yesterday at 22:13", otherwise "12/11/2026 22:13". */
export function formatMessageTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const time = formatTimeOfDay(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)

  if (date >= startOfToday) return `Today at ${time}`
  if (date >= startOfYesterday) return `Yesterday at ${time}`
  return `${date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${time}`
}

/** Same string for two timestamps on the same local calendar day. */
export function localDayKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/** "Today", "Yesterday", otherwise "12 November 2026". */
export function formatDayDivider(iso: string, now = new Date()): string {
  const day = localDayKey(iso)
  if (day === localDayKey(now.toISOString())) return 'Today'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (day === localDayKey(yesterday.toISOString())) return 'Yesterday'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
