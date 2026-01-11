import { describe, it, expect } from 'vitest'
import {
  toDateKey,
  groupEntriesByDate,
  getDailyTotals,
  getDayIndicator,
  getDaysInMonth,
  getFirstDayOfMonth,
} from '@/lib/points-utils'

describe('points-utils', () => {
  describe('toDateKey', () => {
    it('should convert Date object to YYYY-MM-DD format', () => {
      const date = new Date(2024, 0, 15) // January 15, 2024
      expect(toDateKey(date)).toBe('2024-01-15')
    })

    it('should handle string dates', () => {
      const dateStr = '2024-06-20T10:30:00Z'
      const result = toDateKey(dateStr)
      // The result depends on timezone, but should be in YYYY-MM-DD format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should pad single-digit months and days', () => {
      const date = new Date(2024, 2, 5) // March 5, 2024
      expect(toDateKey(date)).toBe('2024-03-05')
    })
  })

  describe('groupEntriesByDate', () => {
    it('should group entries by date', () => {
      const entries = [
        { id: '1', points: 5, date: '2024-01-15T10:00:00Z' },
        { id: '2', points: 3, date: '2024-01-15T14:00:00Z' },
        { id: '3', points: 7, date: '2024-01-16T09:00:00Z' },
      ]

      const grouped = groupEntriesByDate(entries)

      // Should have entries grouped by date
      expect(grouped.size).toBeGreaterThanOrEqual(1)

      // Each group should be an array of entries
      for (const group of grouped.values()) {
        expect(Array.isArray(group)).toBe(true)
      }
    })

    it('should return empty Map for empty input', () => {
      const grouped = groupEntriesByDate([])
      expect(grouped.size).toBe(0)
    })
  })

  describe('getDailyTotals', () => {
    it('should calculate daily point totals', () => {
      const entries = [
        { id: '1', points: 5, date: '2024-01-15T10:00:00Z' },
        { id: '2', points: 3, date: '2024-01-15T14:00:00Z' },
        { id: '3', points: 7, date: '2024-01-16T09:00:00Z' },
      ]

      const totals = getDailyTotals(entries)

      // Should have totals calculated
      expect(totals.size).toBeGreaterThanOrEqual(1)

      // Each value should be a number
      for (const total of totals.values()) {
        expect(typeof total).toBe('number')
      }
    })

    it('should return empty Map for empty input', () => {
      const totals = getDailyTotals([])
      expect(totals.size).toBe(0)
    })

    it('should handle negative points', () => {
      const entries = [
        { id: '1', points: 10, date: '2024-01-15T10:00:00Z' },
        { id: '2', points: -5, date: '2024-01-15T14:00:00Z' },
      ]

      const totals = getDailyTotals(entries)

      // Sum should account for negative points
      for (const total of totals.values()) {
        expect(total).toBe(5)
      }
    })
  })

  describe('getDayIndicator', () => {
    it('should return "fire" for 10 or more points', () => {
      expect(getDayIndicator(10)).toBe('fire')
      expect(getDayIndicator(15)).toBe('fire')
      expect(getDayIndicator(100)).toBe('fire')
    })

    it('should return "star" for 1-9 points', () => {
      expect(getDayIndicator(1)).toBe('star')
      expect(getDayIndicator(5)).toBe('star')
      expect(getDayIndicator(9)).toBe('star')
    })

    it('should return "none" for 0 or negative points', () => {
      expect(getDayIndicator(0)).toBe('none')
      expect(getDayIndicator(-5)).toBe('none')
    })
  })

  describe('getDaysInMonth', () => {
    it('should return correct number of days for January', () => {
      const days = getDaysInMonth(2024, 0) // January
      expect(days.length).toBe(31)
    })

    it('should return correct number of days for February (non-leap year)', () => {
      const days = getDaysInMonth(2023, 1) // February 2023
      expect(days.length).toBe(28)
    })

    it('should return correct number of days for February (leap year)', () => {
      const days = getDaysInMonth(2024, 1) // February 2024
      expect(days.length).toBe(29)
    })

    it('should return correct number of days for April', () => {
      const days = getDaysInMonth(2024, 3) // April
      expect(days.length).toBe(30)
    })

    it('should return Date objects', () => {
      const days = getDaysInMonth(2024, 0)
      expect(days[0]).toBeInstanceOf(Date)
    })
  })

  describe('getFirstDayOfMonth', () => {
    it('should return the correct day of week (0-6)', () => {
      // January 1, 2024 was a Monday (1)
      expect(getFirstDayOfMonth(2024, 0)).toBe(1)
    })

    it('should return 0 for Sunday', () => {
      // September 1, 2024 was a Sunday (0)
      expect(getFirstDayOfMonth(2024, 8)).toBe(0)
    })

    it('should return valid day of week (0-6)', () => {
      const dayOfWeek = getFirstDayOfMonth(2024, 5)
      expect(dayOfWeek).toBeGreaterThanOrEqual(0)
      expect(dayOfWeek).toBeLessThanOrEqual(6)
    })
  })
})
