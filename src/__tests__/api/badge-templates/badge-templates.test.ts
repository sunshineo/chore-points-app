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

// Mock Prisma
vi.mock('@/lib/db', () => {
  return {
    prisma: {
      badgeTemplate: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      chore: {
        findFirst: vi.fn(),
      },
    }
  }
})

// Get reference to mocked prisma
import { prisma } from '@/lib/db'
const mockPrisma = vi.mocked(prisma)

// Import after mocks
import { GET, POST } from '@/app/api/badge-templates/route'

describe('Badge Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/badge-templates', () => {
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

    it('should return list of templates for the family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.badgeTemplate.findMany.mockResolvedValue([
        {
          id: 'template-1',
          familyId: 'family-1',
          builtInBadgeId: 'streak_7_days_10pts',
          choreId: null,
          type: 'achievement',
          name: 'Custom Week Warrior',
          nameZh: null,
          description: null,
          descriptionZh: null,
          imageUrl: 'https://example.com/image.png',
          icon: null,
          ruleConfig: null,
          isActive: true,
          createdById: 'user-1',
          updatedById: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          chore: null,
          createdBy: { name: 'Parent', email: 'test@example.com' },
          updatedBy: { name: 'Parent', email: 'test@example.com' },
        },
      ])

      const response = await GET()
      const { status, data } = await parseResponse<{ templates: unknown[] }>(response)

      expect(status).toBe(200)
      expect(data.templates).toHaveLength(1)
      expect(data.templates[0]).toHaveProperty('builtInBadgeId', 'streak_7_days_10pts')
    })

    it('should return empty array if no templates exist', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.badgeTemplate.findMany.mockResolvedValue([])

      const response = await GET()
      const { status, data } = await parseResponse<{ templates: unknown[] }>(response)

      expect(status).toBe(200)
      expect(data.templates).toHaveLength(0)
    })
  })

  describe('POST /api/badge-templates', () => {
    it('should return 400 for invalid type', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { type: 'invalid_type' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', "Invalid type. Must be 'achievement', 'chore_level', or 'custom'")
    })

    it('should return 400 if achievement type without builtInBadgeId', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { type: 'achievement' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'builtInBadgeId is required for achievement type')
    })

    it('should return 400 if chore_level type without choreId', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const request = createMockRequest('POST', { type: 'chore_level' })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(400)
      expect(data).toHaveProperty('error', 'choreId is required for chore_level type')
    })

    it('should return 404 if choreId does not belong to family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.chore.findFirst.mockResolvedValue(null)

      const request = createMockRequest('POST', {
        type: 'chore_level',
        choreId: 'non-existent-chore',
      })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(404)
      expect(data).toHaveProperty('error', 'Chore not found')
    })

    it('should create achievement template successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const createdTemplate = {
        id: 'new-template-id',
        familyId: 'family-1',
        builtInBadgeId: 'streak_7_days_10pts',
        choreId: null,
        type: 'achievement',
        name: 'Custom Name',
        nameZh: '自定义名称',
        description: null,
        descriptionZh: null,
        imageUrl: 'https://example.com/custom.png',
        icon: null,
        ruleConfig: null,
        isActive: true,
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        chore: null,
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      }

      mockPrisma.badgeTemplate.create.mockResolvedValue(createdTemplate)

      const request = createMockRequest('POST', {
        type: 'achievement',
        builtInBadgeId: 'streak_7_days_10pts',
        name: 'Custom Name',
        nameZh: '自定义名称',
        imageUrl: 'https://example.com/custom.png',
      })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ template: { id: string } }>(response)

      expect(status).toBe(201)
      expect(data.template).toBeDefined()
      expect(data.template.id).toBe('new-template-id')
    })

    it('should create chore_level template successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      // Mock chore exists
      mockPrisma.chore.findFirst.mockResolvedValue({
        id: 'chore-1',
        title: 'Clean Room',
        icon: '🧹',
        defaultPoints: 10,
        isActive: true,
        familyId: 'family-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const createdTemplate = {
        id: 'new-template-id',
        familyId: 'family-1',
        builtInBadgeId: null,
        choreId: 'chore-1',
        type: 'chore_level',
        name: null,
        nameZh: null,
        description: null,
        descriptionZh: null,
        imageUrl: 'https://example.com/chore-badge.png',
        icon: '🏠',
        ruleConfig: null,
        isActive: true,
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        chore: { id: 'chore-1', title: 'Clean Room', icon: '🧹' },
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      }

      mockPrisma.badgeTemplate.create.mockResolvedValue(createdTemplate)

      const request = createMockRequest('POST', {
        type: 'chore_level',
        choreId: 'chore-1',
        imageUrl: 'https://example.com/chore-badge.png',
        icon: '🏠',
      })
      const response = await POST(request)
      const { status, data } = await parseResponse<{ template: { id: string; choreId: string } }>(response)

      expect(status).toBe(201)
      expect(data.template).toBeDefined()
      expect(data.template.choreId).toBe('chore-1')
    })

    it('should return 409 for duplicate template', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.badgeTemplate.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`familyId`,`builtInBadgeId`)')
      )

      const request = createMockRequest('POST', {
        type: 'achievement',
        builtInBadgeId: 'streak_7_days_10pts',
      })
      const response = await POST(request)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(409)
      expect(data).toHaveProperty('error', 'A template for this badge already exists')
    })
  })
})
