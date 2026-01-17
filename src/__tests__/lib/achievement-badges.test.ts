import { describe, it, expect } from 'vitest'
import {
  ACHIEVEMENT_BADGES,
  getAchievementBadgeById,
  getAllAchievementBadges,
} from '@/lib/achievement-badges'

describe('achievement-badges lib', () => {
  describe('ACHIEVEMENT_BADGES', () => {
    it('should have achievement badges defined', () => {
      expect(ACHIEVEMENT_BADGES.length).toBeGreaterThanOrEqual(10)
    })

    it('should have unique ids for all badges', () => {
      const ids = ACHIEVEMENT_BADGES.map((b) => b.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have required properties on each badge', () => {
      ACHIEVEMENT_BADGES.forEach((badge) => {
        expect(badge).toHaveProperty('id')
        expect(badge).toHaveProperty('name')
        expect(badge).toHaveProperty('nameZh')
        expect(badge).toHaveProperty('description')
        expect(badge).toHaveProperty('descriptionZh')
        expect(badge).toHaveProperty('icon')
        expect(badge).toHaveProperty('evaluate')
        expect(typeof badge.evaluate).toBe('function')
      })
    })

    it('should include streak badges', () => {
      const streakBadges = ACHIEVEMENT_BADGES.filter((b) =>
        b.id.startsWith('streak_')
      )
      expect(streakBadges.length).toBeGreaterThanOrEqual(3)
    })

    it('should include milestone badges', () => {
      const milestoneBadges = ACHIEVEMENT_BADGES.filter((b) =>
        b.id.startsWith('milestone_')
      )
      expect(milestoneBadges.length).toBeGreaterThanOrEqual(3)
    })

    it('should include variety badges', () => {
      const varietyBadges = ACHIEVEMENT_BADGES.filter((b) =>
        b.id.startsWith('variety_')
      )
      expect(varietyBadges.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getAchievementBadgeById', () => {
    it('should return badge for valid id', () => {
      const badge = getAchievementBadgeById('streak_7_days_10pts')
      expect(badge).toBeDefined()
      expect(badge?.id).toBe('streak_7_days_10pts')
      expect(badge?.name).toBe('Week Warrior')
      expect(badge?.nameZh).toBe('周冠军')
    })

    it('should return badge for first_chore id', () => {
      const badge = getAchievementBadgeById('first_chore')
      expect(badge).toBeDefined()
      expect(badge?.name).toBe('Getting Started')
      expect(badge?.icon).toBe('🎉')
    })

    it('should return badge for milestone_100_points id', () => {
      const badge = getAchievementBadgeById('milestone_100_points')
      expect(badge).toBeDefined()
      expect(badge?.name).toBe('Century Club')
      expect(badge?.icon).toBe('💯')
    })

    it('should return undefined for non-existent id', () => {
      const badge = getAchievementBadgeById('non_existent_badge')
      expect(badge).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const badge = getAchievementBadgeById('')
      expect(badge).toBeUndefined()
    })
  })

  describe('getAllAchievementBadges', () => {
    it('should return all badges', () => {
      const badges = getAllAchievementBadges()
      expect(badges).toBe(ACHIEVEMENT_BADGES)
      expect(badges.length).toBeGreaterThanOrEqual(10)
    })

    it('should return badges with evaluate functions', () => {
      const badges = getAllAchievementBadges()
      badges.forEach((badge) => {
        expect(typeof badge.evaluate).toBe('function')
      })
    })
  })

  describe('Badge icon emojis', () => {
    it('should have valid emoji icons', () => {
      const badges = getAllAchievementBadges()
      badges.forEach((badge) => {
        expect(badge.icon).toBeTruthy()
        expect(badge.icon.length).toBeGreaterThan(0)
      })
    })

    it('should have expected icons for specific badges', () => {
      expect(getAchievementBadgeById('streak_7_days_10pts')?.icon).toBe('🔥')
      expect(getAchievementBadgeById('streak_14_days_10pts')?.icon).toBe('⚡')
      expect(getAchievementBadgeById('streak_30_days_10pts')?.icon).toBe('👑')
      expect(getAchievementBadgeById('milestone_1000_points')?.icon).toBe('🏆')
      expect(getAchievementBadgeById('variety_5_chores')?.icon).toBe('🎭')
    })
  })
})
