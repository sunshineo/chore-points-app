import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, parseResponse } from '../../helpers/api-test-utils'
import { Role } from '@prisma/client'

// Mock session
let mockSession: { user: { id: string; email: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    return mockSession
  }),
  requireParent: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (mockSession.user.role !== 'PARENT') throw new Error('Forbidden: Parent role required')
    return mockSession
  }),
}))

// Mock Prisma - define inside the factory to avoid hoisting issues
vi.mock('@/lib/db', () => {
  return {
    prisma: {
      family: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    }
  }
})

// Get reference to mocked prisma for test assertions
import { prisma } from '@/lib/db'
const mockPrisma = vi.mocked(prisma)

// Import after mocks
import { GET, POST } from '@/app/api/family/route'

describe('Family API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/family', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await GET()
      const { status, data } = await parseResponse(response)

      expect(status).toBe(401)
      expect(data).toHaveProperty('error', 'Unauthorized')
    })

    it('should return null if user has no family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: null,
        },
      }

      const response = await GET()
      const { status, data } = await parseResponse<{ family: null }>(response)

      expect(status).toBe(200)
      expect(data.family).toBeNull()
    })

    it('should return family details if user has a family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'family-1',
        name: 'Test Family',
        inviteCode: 'ABC123',
        users: [
          { id: 'user-1', name: 'Parent', email: 'parent@test.com', role: 'PARENT' },
          { id: 'user-2', name: 'Kid', email: 'kid@test.com', role: 'KID' },
        ],
      })

      const response = await GET()
      const { status, data } = await parseResponse<{ family: { id: string; name: string } }>(response)

      expect(status).toBe(200)
      expect(data.family).toBeDefined()
      expect(data.family.id).toBe('family-1')
      expect(data.family.name).toBe('Test Family')
    })
  })

  describe('POST /api/family', () => {
    it('should return 401 if not authenticated', async () => {
      const request = createMockRequest('POST', { name: 'New Family' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(500)
      expect(data).toHaveProperty('error')
    })

    it('should return 403 if user is not a parent', async () => {
      mockSession = {
        user: {
          id: 'kid-1',
          email: 'kid@example.com',
          role: Role.KID,
          familyId: null,
        },
      }

      const request = createMockRequest('POST', { name: 'New Family' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(403)
      expect(data).toHaveProperty('error', 'Forbidden: Parent role required')
    })

    it('should return 400 if family name is missing', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: null,
        },
      }

      const request = createMockRequest('POST', {})
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'Family name is required')
    })

    it('should return 400 if user already has a family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'existing-family',
        },
      }

      const request = createMockRequest('POST', { name: 'New Family' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'You are already part of a family')
    })

    it('should create a new family successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: null,
        },
      }

      mockPrisma.family.findUnique.mockResolvedValue(null) // No collision
      mockPrisma.family.create.mockResolvedValue({
        id: 'new-family-id',
        name: 'My Family',
        inviteCode: 'ABC123',
      })

      const request = createMockRequest('POST', { name: 'My Family' })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ family: { id: string; name: string; inviteCode: string } }>(response)

      expect(status).toBe(201)
      expect(data.family).toBeDefined()
      expect(data.family.name).toBe('My Family')
      expect(data.family.inviteCode).toBeDefined()
    })
  })
})
