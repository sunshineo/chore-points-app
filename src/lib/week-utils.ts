/**
 * Get the Monday 00:00:00 of the week containing the given date.
 * Week starts on Monday (ISO week).
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We want Monday as day 0, so: (day + 6) % 7 gives us days since Monday
  const daysSinceMonday = (day + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Check if two dates are in the same week (Monday to Sunday).
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
  const week1 = getWeekStart(date1)
  const week2 = getWeekStart(date2)
  return week1.getTime() === week2.getTime()
}
