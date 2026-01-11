import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, parseResponse } from '../../helpers/api-test-utils'
import { Role } from '@prisma/client'

// Mock session
let mockSession: { user: { id: string; email: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireFamily: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (!mockSession.user.familyId) throw new Error('Forbidden: Must be part of a family')
    return mockSession
  }),
  requireParentInFamily: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (mockSession.user.role !== 'PARENT') throw new Error('Forbidden: Parent role required')
    if (!mockSession.user.familyId) throw new Error('Forbidden: Must be part of a family')
    return mockSession
  }),
}))

// Mock Prisma - define inside the factory to avoid hoisting issues
vi.mock('@/lib/db', () => {
  return {
    prisma: {
      reward: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    }
  }
})

// Get reference to mocked prisma for test assertions
import { prisma } from '@/lib/db'
const mockPrisma = vi.mocked(prisma)

// Import after mocks
import { GET, POST } from '@/app/api/rewards/route'

describe('Rewards API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/rewards', () => {
    it('should return 500 if not authenticated', async () => {
      const response = await GET()
      const { status, data } = await parseResponse(response)

      expect(status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    it('should allow kids to view rewards', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.findMany.mockResolvedValue([
        {
          id: 'reward-1',
          title: 'Ice cream',
          costPoints: 50,
          imageUrl: null,
          familyId: 'family-1',
          createdBy: { name: 'Parent', email: 'parent@test.com' },
          updatedBy: { name: 'Parent', email: 'parent@test.com' },
        },
      ])

      const response = await GET()
      const { status, data } = await parseResponse<{ rewards: unknown[] }>(response)

      expect(status).toBe(200)
      expect(data.rewards).toHaveLength(1)
    })

    it('should return list of rewards for the family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.findMany.mockResolvedValue([
        {
          id: 'reward-1',
          title: 'Ice cream',
          costPoints: 50,
          imageUrl: null,
          familyId: 'family-1',
          createdBy: { name: 'Parent', email: 'parent@test.com' },
          updatedBy: { name: 'Parent', email: 'parent@test.com' },
        },
        {
          id: 'reward-2',
          title: 'Movie night',
          costPoints: 100,
          imageUrl: 'http://example.com/movie.jpg',
          familyId: 'family-1',
          createdBy: { name: 'Parent', email: 'parent@test.com' },
          updatedBy: { name: 'Parent', email: 'parent@test.com' },
        },
      ])

      const response = await GET()
      const { status, data } = await parseResponse<{ rewards: { id: string; title: string; costPoints: number }[] }>(response)

      expect(status).toBe(200)
      expect(data.rewards).toHaveLength(2)
      expect(data.rewards[0].title).toBe('Ice cream')
      expect(data.rewards[1].costPoints).toBe(100)
    })
  })

  describe('POST /api/rewards', () => {
    it('should return 500 if not a parent', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { title: 'Ice cream', costPoints: 50 })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    it('should return 400 if title is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { costPoints: 50 })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Title is required and must be a string')
    })

    it('should return 400 if costPoints is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { title: 'Ice cream' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Cost points must be a positive number')
    })

    it('should return 400 if costPoints is zero or negative', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { title: 'Ice cream', costPoints: 0 })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Cost points must be a positive number')
    })

    it('should create reward successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.create.mockResolvedValue({
        id: 'new-reward-id',
        title: 'Ice cream',
        costPoints: 50,
        imageUrl: null,
        familyId: 'family-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('POST', { title: 'Ice cream', costPoints: 50 })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ reward: { id: string; title: string; costPoints: number } }>(response)

      expect(status).toBe(201)
      expect(data.reward).toBeDefined()
      expect(data.reward.title).toBe('Ice cream')
      expect(data.reward.costPoints).toBe(50)
    })

    it('should create reward with image URL', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.create.mockResolvedValue({
        id: 'new-reward-id',
        title: 'Movie night',
        costPoints: 100,
        imageUrl: 'http://example.com/movie.jpg',
        familyId: 'family-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('POST', {
        title: 'Movie night',
        costPoints: 100,
        imageUrl: 'http://example.com/movie.jpg',
      })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ reward: { imageUrl: string } }>(response)

      expect(status).toBe(201)
      expect(data.reward.imageUrl).toBe('http://example.com/movie.jpg')
    })
  })
})
