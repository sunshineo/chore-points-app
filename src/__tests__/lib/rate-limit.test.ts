import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, checkRateLimit, rateLimitedResponse } from '@/lib/rate-limit'

// Create a mock request with specific IP
function createMockRequest(ip: string = '127.0.0.1'): Request {
  return new Request('http://localhost/api/test', {
    headers: {
      'x-forwarded-for': ip,
    },
  })
}

describe('rate-limit', () => {
  describe('rateLimit', () => {
    it('should create a rate limiter with check function', () => {
      const limiter = rateLimit({ limit: 5, windowMs: 60000 })
      expect(limiter.check).toBeDefined()
      expect(typeof limiter.check).toBe('function')
    })

    it('should create a rate limiter with headers function', () => {
      const limiter = rateLimit({ limit: 5, windowMs: 60000 })
      expect(limiter.headers).toBeDefined()
      expect(typeof limiter.headers).toBe('function')
    })

    it('should allow requests within limit', () => {
      const limiter = rateLimit({ limit: 3, windowMs: 60000 })
      const ip = `test-ip-${Date.now()}-allow`
      const request = createMockRequest(ip)

      const result1 = limiter.check(request)
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(2)

      const result2 = limiter.check(request)
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(1)

      const result3 = limiter.check(request)
      expect(result3.success).toBe(true)
      expect(result3.remaining).toBe(0)
    })

    it('should block requests over limit', () => {
      const limiter = rateLimit({ limit: 2, windowMs: 60000 })
      const ip = `test-ip-${Date.now()}-block`
      const request = createMockRequest(ip)

      // Use up the limit
      limiter.check(request)
      limiter.check(request)

      // Third request should be blocked
      const result = limiter.check(request)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.message).toBeDefined()
    })

    it('should track different IPs separately', () => {
      const limiter = rateLimit({ limit: 1, windowMs: 60000 })
      const ip1 = `test-ip-${Date.now()}-1`
      const ip2 = `test-ip-${Date.now()}-2`

      const request1 = createMockRequest(ip1)
      const request2 = createMockRequest(ip2)

      // First request from IP1
      const result1 = limiter.check(request1)
      expect(result1.success).toBe(true)

      // First request from IP2 (different IP)
      const result2 = limiter.check(request2)
      expect(result2.success).toBe(true)

      // Second request from IP1 should be blocked
      const result3 = limiter.check(request1)
      expect(result3.success).toBe(false)
    })

    it('should use custom message', () => {
      const customMessage = 'Custom rate limit message'
      const limiter = rateLimit({ limit: 1, windowMs: 60000, message: customMessage })
      const ip = `test-ip-${Date.now()}-custom`
      const request = createMockRequest(ip)

      limiter.check(request) // Use up limit
      const result = limiter.check(request)

      expect(result.message).toBe(customMessage)
    })

    it('should include rate limit info in result', () => {
      const limiter = rateLimit({ limit: 5, windowMs: 60000 })
      const ip = `test-ip-${Date.now()}-info`
      const request = createMockRequest(ip)

      const result = limiter.check(request)

      expect(result.limit).toBe(5)
      expect(result.remaining).toBe(4)
      expect(result.resetTime).toBeDefined()
      expect(result.resetTime).toBeGreaterThan(Date.now())
    })
  })

  describe('headers', () => {
    it('should generate rate limit headers', () => {
      const limiter = rateLimit({ limit: 5, windowMs: 60000 })
      const result = {
        success: true,
        limit: 5,
        remaining: 4,
        resetTime: Date.now() + 60000,
      }

      const headers = limiter.headers(result)

      expect(headers.get('X-RateLimit-Limit')).toBe('5')
      expect(headers.get('X-RateLimit-Remaining')).toBe('4')
      expect(headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('should include Retry-After header when rate limited', () => {
      const limiter = rateLimit({ limit: 5, windowMs: 60000 })
      const result = {
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 30000, // 30 seconds from now
        message: 'Rate limited',
      }

      const headers = limiter.headers(result)

      expect(headers.get('Retry-After')).toBeDefined()
    })
  })

  describe('checkRateLimit', () => {
    it('should return null when within limit', () => {
      const limiter = rateLimit({ limit: 5, windowMs: 60000 })
      const ip = `test-ip-${Date.now()}-check`
      const request = createMockRequest(ip)

      const response = checkRateLimit(request, limiter)
      expect(response).toBeNull()
    })

    it('should return 429 response when over limit', () => {
      const limiter = rateLimit({ limit: 1, windowMs: 60000 })
      const ip = `test-ip-${Date.now()}-check429`
      const request = createMockRequest(ip)

      checkRateLimit(request, limiter) // Use up limit
      const response = checkRateLimit(request, limiter)

      expect(response).not.toBeNull()
      expect(response?.status).toBe(429)
    })
  })

  describe('rateLimitedResponse', () => {
    it('should create a 429 response', async () => {
      const result = {
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 60000,
        message: 'Too many requests',
      }

      const response = rateLimitedResponse(result)

      expect(response.status).toBe(429)
    })

    it('should include rate limit headers', async () => {
      const result = {
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 60000,
        message: 'Too many requests',
      }

      const response = rateLimitedResponse(result)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('Retry-After')).toBeDefined()
    })

    it('should include error message in response body', async () => {
      const result = {
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 60000,
        message: 'Too many requests',
      }

      const response = rateLimitedResponse(result)
      const body = await response.json()

      expect(body.error).toBe('Too many requests')
    })
  })
})
