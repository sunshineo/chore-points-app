import { describe, it, expect } from 'vitest'
import { getWeekStart, isSameWeek } from '@/lib/week-utils'

describe('week-utils', () => {
  describe('getWeekStart', () => {
    it('should return Monday 00:00:00 for a Wednesday', () => {
      // Wednesday Jan 29, 2026
      const date = new Date('2026-01-29T14:30:00')
      const weekStart = getWeekStart(date)

      expect(weekStart.getDay()).toBe(1) // Monday
      expect(weekStart.getHours()).toBe(0)
      expect(weekStart.getMinutes()).toBe(0)
      expect(weekStart.getSeconds()).toBe(0)
      expect(weekStart.getDate()).toBe(26) // Monday Jan 26
    })

    it('should return same day for a Monday', () => {
      // Monday Jan 26, 2026
      const date = new Date('2026-01-26T10:00:00')
      const weekStart = getWeekStart(date)

      expect(weekStart.getDay()).toBe(1)
      expect(weekStart.getDate()).toBe(26)
    })

    it('should return previous Monday for a Sunday', () => {
      // Sunday Feb 1, 2026
      const date = new Date('2026-02-01T23:59:59')
      const weekStart = getWeekStart(date)

      expect(weekStart.getDay()).toBe(1)
      expect(weekStart.getDate()).toBe(26) // Monday Jan 26
    })
  })

  describe('isSameWeek', () => {
    it('should return true for dates in the same week', () => {
      const monday = new Date('2026-01-26T00:00:00')
      const friday = new Date('2026-01-30T23:59:59')

      expect(isSameWeek(monday, friday)).toBe(true)
    })

    it('should return false for dates in different weeks', () => {
      const sunday = new Date('2026-01-25T23:59:59')
      const monday = new Date('2026-01-26T00:00:00')

      expect(isSameWeek(sunday, monday)).toBe(false)
    })
  })
})
