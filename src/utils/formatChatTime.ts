/** "19:02" today, "Yesterday", weekday within the last week, otherwise "12 Nov". */
export function formatChatTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const daysAgo = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)

  if (date >= daysAgo(0)) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (date >= daysAgo(1)) return 'Yesterday'
  if (date >= daysAgo(6)) return date.toLocaleDateString(undefined, { weekday: 'short' })
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
