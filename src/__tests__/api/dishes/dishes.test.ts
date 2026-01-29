import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, parseResponse } from '../../helpers/api-test-utils'
import { Role } from '@prisma/client'

let mockSession: { user: { id: string; email: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireFamily: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (!mockSession.user.familyId) throw new Error('Forbidden: Must be part of a family')
    return mockSession
  }),
}))

vi.mock('@/lib/db', () => {
  return {
    prisma: {
      dish: {
        findMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      mealLog: {
        create: vi.fn(),
      },
    }
  }
})

import { prisma } from '@/lib/db'
const mockPrisma = vi.mocked(prisma)

import { GET, POST } from '@/app/api/dishes/route'

describe('Dishes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/dishes', () => {
    it('should return 500 if not authenticated', async () => {
      const response = await GET()
      const { status, data } = await parseResponse(response)

      expect(status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    it('should return list of dishes for the family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.dish.findMany.mockResolvedValue([
        {
          id: 'dish-1',
          name: 'Beef Stir Fry',
          photoUrl: 'https://example.com/beef.jpg',
          totalVotes: 3,
          familyId: 'family-1',
          createdById: 'user-1',
          createdBy: { id: 'user-1', name: 'Parent', email: 'test@example.com' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const response = await GET()
      const { status, data } = await parseResponse<{ dishes: unknown[] }>(response)

      expect(status).toBe(200)
      expect(data.dishes).toHaveLength(1)
      expect(data.dishes[0]).toHaveProperty('name', 'Beef Stir Fry')
    })
  })

  describe('POST /api/dishes', () => {
    it('should return 400 if name is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { photoUrl: 'https://example.com/photo.jpg' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('should return 400 if photoUrl is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { name: 'Test Dish' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('should create dish successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.dish.create.mockResolvedValue({
        id: 'new-dish-id',
        name: 'Chicken Curry',
        photoUrl: 'https://example.com/curry.jpg',
        totalVotes: 0,
        familyId: 'family-1',
        createdById: 'user-1',
        createdBy: { id: 'user-1', name: 'Parent', email: 'test@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = createMockRequest('POST', {
        name: 'Chicken Curry',
        photoUrl: 'https://example.com/curry.jpg',
      })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ dish: { id: string; name: string } }>(response)

      expect(status).toBe(201)
      expect(data.dish).toBeDefined()
      expect(data.dish.name).toBe('Chicken Curry')
    })
  })
})
