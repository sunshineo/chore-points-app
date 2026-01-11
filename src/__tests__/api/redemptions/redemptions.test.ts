import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, parseResponse } from '../../helpers/api-test-utils'
import { Role, RedemptionStatus } from '@prisma/client'

// Mock session
let mockSession: { user: { id: string; email: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireFamily: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (!mockSession.user.familyId) throw new Error('Forbidden: Must be part of a family')
    return mockSession
  }),
}))

// Mock Prisma - define inside the factory to avoid hoisting issues
vi.mock('@/lib/db', () => {
  return {
    prisma: {
      redemption: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      reward: {
        findUnique: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      pointEntry: {
        findMany: vi.fn(),
      },
    }
  }
})

// Get reference to mocked prisma for test assertions
import { prisma } from '@/lib/db'
const mockPrisma = vi.mocked(prisma)

// Import after mocks
import { GET, POST } from '@/app/api/redemptions/route'

describe('Redemptions API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/redemptions', () => {
    it('should return 500 if not authenticated', async () => {
      const request = createMockRequest('GET', undefined, {
        url: 'http://localhost:3000/api/redemptions',
      })
      const response = await GET(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    it('should return list of redemptions for family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.redemption.findMany.mockResolvedValue([
        {
          id: 'redemption-1',
          status: RedemptionStatus.PENDING,
          kid: { name: 'Kid 1', email: 'kid1@test.com' },
          reward: { title: 'Ice cream', costPoints: 50, imageUrl: null },
          resolvedBy: null,
        },
        {
          id: 'redemption-2',
          status: RedemptionStatus.APPROVED,
          kid: { name: 'Kid 1', email: 'kid1@test.com' },
          reward: { title: 'Movie night', costPoints: 100, imageUrl: null },
          resolvedBy: { name: 'Parent', email: 'parent@test.com' },
        },
      ])

      const request = createMockRequest('GET', undefined, {
        url: 'http://localhost:3000/api/redemptions',
      })
      const response = await GET(request)
      const { status, data } = await parseResponse<{ redemptions: unknown[] }>(response)

      expect(status).toBe(200)
      expect(data.redemptions).toHaveLength(2)
    })

    it('should filter by kidId', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.redemption.findMany.mockResolvedValue([
        {
          id: 'redemption-1',
          status: RedemptionStatus.PENDING,
          kidId: 'kid-1',
          kid: { name: 'Kid 1', email: 'kid1@test.com' },
          reward: { title: 'Ice cream', costPoints: 50, imageUrl: null },
          resolvedBy: null,
        },
      ])

      const request = createMockRequest('GET', undefined, {
        url: 'http://localhost:3000/api/redemptions?kidId=kid-1',
      })
      const response = await GET(request)
      const { status } = await parseResponse(response)

      expect(status).toBe(200)
      expect(mockPrisma.redemption.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            kidId: 'kid-1',
          }),
        })
      )
    })

    it('should filter by status', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.redemption.findMany.mockResolvedValue([])

      const request = createMockRequest('GET', undefined, {
        url: 'http://localhost:3000/api/redemptions?status=PENDING',
      })
      const response = await GET(request)

      expect(mockPrisma.redemption.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })
  })

  describe('POST /api/redemptions', () => {
    it('should return 400 if rewardId is missing', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', {})
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Reward ID is required')
    })

    it('should return 404 if reward not found', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', { rewardId: 'nonexistent' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(404)
      expect(data).toHaveProperty('error', 'Reward not found')
    })

    it('should return 403 if reward belongs to another family', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.findUnique.mockResolvedValue({
        id: 'reward-1',
        title: 'Ice cream',
        costPoints: 50,
        familyId: 'other-family', // Different family
      })

      const request = createMockRequest('POST', { rewardId: 'reward-1' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(403)
      expect(data).toHaveProperty('error', 'Reward belongs to another family')
    })

    it('should return 400 if insufficient points', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.findUnique.mockResolvedValue({
        id: 'reward-1',
        title: 'Ice cream',
        costPoints: 100,
        familyId: 'family-1',
      })

      mockPrisma.pointEntry.findMany.mockResolvedValue([
        { points: 30 },
        { points: 20 },
      ]) // Total: 50 points, need 100

      const request = createMockRequest('POST', { rewardId: 'reward-1' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Insufficient points for this reward')
    })

    it('should create redemption request for kid', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      mockPrisma.reward.findUnique.mockResolvedValue({
        id: 'reward-1',
        title: 'Ice cream',
        costPoints: 50,
        familyId: 'family-1',
      })

      mockPrisma.pointEntry.findMany.mockResolvedValue([
        { points: 30 },
        { points: 40 },
      ]) // Total: 70 points

      mockPrisma.redemption.create.mockResolvedValue({
        id: 'new-redemption',
        status: RedemptionStatus.PENDING,
        familyId: 'family-1',
        kidId: 'kid-1',
        rewardId: 'reward-1',
        kid: { name: 'Kid', email: 'kid@example.com' },
        reward: { title: 'Ice cream', costPoints: 50, imageUrl: null },
      })

      const request = createMockRequest('POST', { rewardId: 'reward-1' })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ redemption: { id: string; status: RedemptionStatus } }>(response)

      expect(status).toBe(201)
      expect(data.redemption).toBeDefined()
      expect(data.redemption.status).toBe(RedemptionStatus.PENDING)
    })

    it('should allow parent to create redemption on behalf of kid', async () => {
      mockSession = {
        user: {
          id: 'parent-1',
          email: 'parent@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'kid-1',
        name: 'Kid',
        email: 'kid@example.com',
        role: Role.KID,
        familyId: 'family-1',
      })

      mockPrisma.reward.findUnique.mockResolvedValue({
        id: 'reward-1',
        title: 'Ice cream',
        costPoints: 50,
        familyId: 'family-1',
      })

      mockPrisma.pointEntry.findMany.mockResolvedValue([
        { points: 100 },
      ])

      mockPrisma.redemption.create.mockResolvedValue({
        id: 'new-redemption',
        status: RedemptionStatus.PENDING,
        familyId: 'family-1',
        kidId: 'kid-1',
        rewardId: 'reward-1',
        kid: { name: 'Kid', email: 'kid@example.com' },
        reward: { title: 'Ice cream', costPoints: 50, imageUrl: null },
      })

      const request = createMockRequest('POST', { rewardId: 'reward-1', kidId: 'kid-1' })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ redemption: { id: string } }>(response)

      expect(status).toBe(201)
      expect(data.redemption).toBeDefined()
    })

    it('should return 404 if kid not found in family for parent', async () => {
      mockSession = {
        user: {
          id: 'parent-1',
          email: 'parent@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.user.findFirst.mockResolvedValue(null)

      const request = createMockRequest('POST', { rewardId: 'reward-1', kidId: 'nonexistent-kid' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(404)
      expect(data).toHaveProperty('error', 'Kid not found in your family')
    })

    it('should return 400 if parent has no kidId', async () => {
      mockSession = {
        user: {
          id: 'parent-1',
          email: 'parent@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { rewardId: 'reward-1' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Invalid request')
    })
  })
})
