import { describe, it, expect } from 'vitest'
import {
  BADGE_LEVELS,
  calculateLevel,
  getLevelInfo,
  getNextLevelInfo,
  getProgressToNextLevel,
} from '@/lib/badges'

describe('badges lib', () => {
  describe('BADGE_LEVELS', () => {
    it('should have 6 levels defined', () => {
      expect(BADGE_LEVELS).toHaveLength(6)
    })

    it('should have correct thresholds in ascending order', () => {
      const thresholds = BADGE_LEVELS.map((l) => l.threshold)
      expect(thresholds).toEqual([1, 10, 20, 30, 40, 50])
    })

    it('should have levels 1-6', () => {
      const levels = BADGE_LEVELS.map((l) => l.level)
      expect(levels).toEqual([1, 2, 3, 4, 5, 6])
    })
  })

  describe('calculateLevel', () => {
    it('should return 0 for count of 0', () => {
      expect(calculateLevel(0)).toBe(0)
    })

    it('should return level 1 for count of 1', () => {
      expect(calculateLevel(1)).toBe(1)
    })

    it('should return level 1 for count of 9', () => {
      expect(calculateLevel(9)).toBe(1)
    })

    it('should return level 2 for count of 10', () => {
      expect(calculateLevel(10)).toBe(2)
    })

    it('should return level 2 for count of 19', () => {
      expect(calculateLevel(19)).toBe(2)
    })

    it('should return level 3 for count of 20', () => {
      expect(calculateLevel(20)).toBe(3)
    })

    it('should return level 4 for count of 30', () => {
      expect(calculateLevel(30)).toBe(4)
    })

    it('should return level 5 for count of 40', () => {
      expect(calculateLevel(40)).toBe(5)
    })

    it('should return level 6 for count of 50', () => {
      expect(calculateLevel(50)).toBe(6)
    })

    it('should return level 6 for count above 50', () => {
      expect(calculateLevel(100)).toBe(6)
      expect(calculateLevel(999)).toBe(6)
    })
  })

  describe('getLevelInfo', () => {
    it('should return correct info for level 1', () => {
      const info = getLevelInfo(1)
      expect(info).toEqual({
        level: 1,
        threshold: 1,
        name: 'Starter',
        icon: '🌱',
      })
    })

    it('should return correct info for level 2', () => {
      const info = getLevelInfo(2)
      expect(info).toEqual({
        level: 2,
        threshold: 10,
        name: 'Bronze',
        icon: '🥉',
      })
    })

    it('should return correct info for level 6', () => {
      const info = getLevelInfo(6)
      expect(info).toEqual({
        level: 6,
        threshold: 50,
        name: 'Super',
        icon: '⭐',
      })
    })

    it('should return null for level 0', () => {
      expect(getLevelInfo(0)).toBeNull()
    })

    it('should return null for level 7', () => {
      expect(getLevelInfo(7)).toBeNull()
    })

    it('should return null for negative level', () => {
      expect(getLevelInfo(-1)).toBeNull()
    })
  })

  describe('getNextLevelInfo', () => {
    it('should return level 2 info when current is level 1', () => {
      const info = getNextLevelInfo(1)
      expect(info?.level).toBe(2)
      expect(info?.name).toBe('Bronze')
    })

    it('should return level 6 info when current is level 5', () => {
      const info = getNextLevelInfo(5)
      expect(info?.level).toBe(6)
      expect(info?.name).toBe('Super')
    })

    it('should return null when current is level 6 (max)', () => {
      expect(getNextLevelInfo(6)).toBeNull()
    })

    it('should return level 1 info when current is level 0', () => {
      const info = getNextLevelInfo(0)
      expect(info?.level).toBe(1)
    })
  })

  describe('getProgressToNextLevel', () => {
    it('should return 0% progress for count of 1 (just started level 1)', () => {
      const result = getProgressToNextLevel(1)
      expect(result.current).toBe(1)
      expect(result.next).toBe(10)
      expect(result.progress).toBe(0)
    })

    it('should return ~50% progress for count of 5 (halfway to level 2)', () => {
      const result = getProgressToNextLevel(5)
      expect(result.current).toBe(5)
      expect(result.next).toBe(10)
      // (5-1) / (10-1) = 4/9 = ~44%
      expect(result.progress).toBe(44)
    })

    it('should return 0% progress for count of 10 (just reached level 2)', () => {
      const result = getProgressToNextLevel(10)
      expect(result.current).toBe(10)
      expect(result.next).toBe(20)
      expect(result.progress).toBe(0)
    })

    it('should return 50% progress for count of 15 (halfway level 2 to 3)', () => {
      const result = getProgressToNextLevel(15)
      expect(result.current).toBe(15)
      expect(result.next).toBe(20)
      expect(result.progress).toBe(50)
    })

    it('should return 100% and null next for max level', () => {
      const result = getProgressToNextLevel(50)
      expect(result.current).toBe(50)
      expect(result.next).toBeNull()
      expect(result.progress).toBe(100)
    })

    it('should return 100% and null next for count above max threshold', () => {
      const result = getProgressToNextLevel(100)
      expect(result.current).toBe(100)
      expect(result.next).toBeNull()
      expect(result.progress).toBe(100)
    })

    it('should handle count of 0', () => {
      const result = getProgressToNextLevel(0)
      expect(result.current).toBe(0)
      expect(result.next).toBe(1)
      // 0 progress since not yet at level 1
      expect(result.progress).toBe(0)
    })
  })
})
