import { describe, it, expect, beforeEach } from 'vitest'
import { generateInviteToken, getInviteExpiration } from '@/lib/invite'

describe('invite utilities', () => {
  describe('generateInviteToken', () => {
    it('should generate a string token', () => {
      const token = generateInviteToken()
      expect(typeof token).toBe('string')
    })

    it('should generate tokens of consistent length', () => {
      const token = generateInviteToken()
      // 32 bytes base64url encoded should be ~43 characters
      expect(token.length).toBeGreaterThan(30)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInviteToken())
      }
      // All 100 tokens should be unique
      expect(tokens.size).toBe(100)
    })

    it('should generate URL-safe tokens', () => {
      const token = generateInviteToken()
      // URL-safe base64 should only contain alphanumeric, -, and _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  describe('getInviteExpiration', () => {
    it('should return a Date object', () => {
      const expiration = getInviteExpiration()
      expect(expiration).toBeInstanceOf(Date)
    })

    it('should return a date 30 days in the future', () => {
      const before = new Date()
      const expiration = getInviteExpiration()
      const after = new Date()

      // Calculate expected range (30 days from now, with some tolerance)
      const expectedMin = new Date(before)
      expectedMin.setDate(expectedMin.getDate() + 30)

      const expectedMax = new Date(after)
      expectedMax.setDate(expectedMax.getDate() + 30)
      expectedMax.setSeconds(expectedMax.getSeconds() + 1) // Add 1 second tolerance

      expect(expiration.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime())
      expect(expiration.getTime()).toBeLessThanOrEqual(expectedMax.getTime())
    })

    it('should return a date in the future', () => {
      const now = new Date()
      const expiration = getInviteExpiration()
      expect(expiration.getTime()).toBeGreaterThan(now.getTime())
    })
  })
})
