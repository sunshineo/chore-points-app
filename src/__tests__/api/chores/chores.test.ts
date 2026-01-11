import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, parseResponse } from '../../helpers/api-test-utils'
import { Role } from '@prisma/client'

// Mock session
let mockSession: { user: { id: string; email: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
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
      chore: {
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
import { GET, POST } from '@/app/api/chores/route'

describe('Chores API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/chores', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await GET()
      const { status, data } = await parseResponse(response)

      expect(status).toBe(401)
      expect(data).toHaveProperty('error')
    })

    it('should return 403 if user is not a parent', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: 'family-1',
        },
      }

      const response = await GET()
      const { status, data } = await parseResponse(response)

      expect(status).toBe(403)
      expect(data).toHaveProperty('error')
    })

    it('should return 403 if user has no family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: null,
        },
      }

      const response = await GET()
      const { status, data } = await parseResponse(response)

      expect(status).toBe(403)
      expect(data).toHaveProperty('error')
    })

    it('should return list of chores for the family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.chore.findMany.mockResolvedValue([
        {
          id: 'chore-1',
          title: 'Clean room',
          defaultPoints: 5,
          isActive: true,
          familyId: 'family-1',
          createdBy: { name: 'Parent', email: 'parent@test.com' },
          updatedBy: { name: 'Parent', email: 'parent@test.com' },
        },
        {
          id: 'chore-2',
          title: 'Do dishes',
          defaultPoints: 3,
          isActive: true,
          familyId: 'family-1',
          createdBy: { name: 'Parent', email: 'parent@test.com' },
          updatedBy: { name: 'Parent', email: 'parent@test.com' },
        },
      ])

      const response = await GET()
      const { status, data } = await parseResponse<{ chores: { id: string; title: string }[] }>(response)

      expect(status).toBe(200)
      expect(data.chores).toHaveLength(2)
      expect(data.chores[0].title).toBe('Clean room')
    })

    it('should return empty array if no chores exist', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.chore.findMany.mockResolvedValue([])

      const response = await GET()
      const { status, data } = await parseResponse<{ chores: unknown[] }>(response)

      expect(status).toBe(200)
      expect(data.chores).toHaveLength(0)
    })
  })

  describe('POST /api/chores', () => {
    it('should return 400 if title is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { defaultPoints: 5 })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Title and defaultPoints are required')
    })

    it('should return 400 if defaultPoints is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { title: 'Clean room' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Title and defaultPoints are required')
    })

    it('should return 400 if defaultPoints is negative', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { title: 'Clean room', defaultPoints: -5 })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'defaultPoints must be a non-negative number')
    })

    it('should return 400 if defaultPoints is not a number', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { title: 'Clean room', defaultPoints: 'five' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'defaultPoints must be a non-negative number')
    })

    it('should create a new chore successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.chore.create.mockResolvedValue({
        id: 'new-chore-id',
        title: 'Clean room',
        icon: null,
        defaultPoints: 5,
        isActive: true,
        familyId: 'family-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('POST', { title: 'Clean room', defaultPoints: 5 })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ chore: { id: string; title: string; defaultPoints: number } }>(response)

      expect(status).toBe(201)
      expect(data.chore).toBeDefined()
      expect(data.chore.title).toBe('Clean room')
      expect(data.chore.defaultPoints).toBe(5)
    })

    it('should create a chore with icon', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.chore.create.mockResolvedValue({
        id: 'new-chore-id',
        title: 'Clean room',
        icon: 'broom',
        defaultPoints: 5,
        isActive: true,
        familyId: 'family-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('POST', { title: 'Clean room', defaultPoints: 5, icon: 'broom' })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ chore: { icon: string } }>(response)

      expect(status).toBe(201)
      expect(data.chore.icon).toBe('broom')
    })

    it('should allow zero points for a chore', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.chore.create.mockResolvedValue({
        id: 'new-chore-id',
        title: 'Brush teeth',
        icon: null,
        defaultPoints: 0,
        isActive: true,
        familyId: 'family-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('POST', { title: 'Brush teeth', defaultPoints: 0 })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ chore: { defaultPoints: number } }>(response)

      expect(status).toBe(201)
      expect(data.chore.defaultPoints).toBe(0)
    })
  })
})
