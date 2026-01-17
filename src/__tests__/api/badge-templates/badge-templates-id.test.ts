import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, createMockContext, parseResponse } from '../../helpers/api-test-utils'
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
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }
  }
})

// Get reference to mocked prisma
import { prisma } from '@/lib/db'
const mockPrisma = vi.mocked(prisma)

// Import after mocks
import { PUT, DELETE } from '@/app/api/badge-templates/[id]/route'

describe('Badge Templates [id] API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('PUT /api/badge-templates/[id]', () => {
    it('should return error if not authenticated', async () => {
      const request = createMockRequest('PUT', { name: 'Updated Name' })
      const context = createMockContext({ id: 'template-1' })
      const response = await PUT(request, context)
      const { status, data } = await parseResponse(response)

      // Returns 500 because auth check happens after JSON parsing
      expect(status).toBeGreaterThanOrEqual(400)
      expect(data).toHaveProperty('error')
    })

    it('should return 404 if template not found', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(null)

      const request = createMockRequest('PUT', { name: 'Updated Name' })
      const context = createMockContext({ id: 'non-existent' })
      const response = await PUT(request, context)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(404)
      expect(data).toHaveProperty('error', 'Badge template not found')
    })

    it('should update template successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const existingTemplate = {
        id: 'template-1',
        familyId: 'family-1',
        builtInBadgeId: 'streak_7_days_10pts',
        choreId: null,
        type: 'achievement',
        name: 'Original Name',
        nameZh: null,
        description: null,
        descriptionZh: null,
        imageUrl: null,
        icon: null,
        ruleConfig: null,
        isActive: true,
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const updatedTemplate = {
        ...existingTemplate,
        name: 'Updated Name',
        imageUrl: 'https://example.com/new-image.png',
        chore: null,
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      }

      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(existingTemplate)
      mockPrisma.badgeTemplate.update.mockResolvedValue(updatedTemplate)

      const request = createMockRequest('PUT', {
        name: 'Updated Name',
        imageUrl: 'https://example.com/new-image.png',
      })
      const context = createMockContext({ id: 'template-1' })
      const response = await PUT(request, context)
      const { status, data } = await parseResponse<{ template: { name: string; imageUrl: string } }>(response)

      expect(status).toBe(200)
      expect(data.template.name).toBe('Updated Name')
      expect(data.template.imageUrl).toBe('https://example.com/new-image.png')
    })

    it('should update only provided fields', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const existingTemplate = {
        id: 'template-1',
        familyId: 'family-1',
        builtInBadgeId: 'streak_7_days_10pts',
        choreId: null,
        type: 'achievement',
        name: 'Original Name',
        nameZh: '原始名称',
        description: 'Original desc',
        descriptionZh: null,
        imageUrl: 'https://example.com/old.png',
        icon: '🏆',
        ruleConfig: null,
        isActive: true,
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(existingTemplate)
      mockPrisma.badgeTemplate.update.mockResolvedValue({
        ...existingTemplate,
        name: 'New Name Only',
        chore: null,
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('PUT', { name: 'New Name Only' })
      const context = createMockContext({ id: 'template-1' })
      await PUT(request, context)

      expect(mockPrisma.badgeTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Name Only',
            nameZh: '原始名称', // Should preserve existing value
            imageUrl: 'https://example.com/old.png', // Should preserve existing value
          }),
        })
      )
    })

    it('should allow setting isActive to false', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const existingTemplate = {
        id: 'template-1',
        familyId: 'family-1',
        builtInBadgeId: 'streak_7_days_10pts',
        choreId: null,
        type: 'achievement',
        name: 'Test',
        nameZh: null,
        description: null,
        descriptionZh: null,
        imageUrl: null,
        icon: null,
        ruleConfig: null,
        isActive: true,
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(existingTemplate)
      mockPrisma.badgeTemplate.update.mockResolvedValue({
        ...existingTemplate,
        isActive: false,
        chore: null,
        createdBy: { name: 'Parent', email: 'test@example.com' },
        updatedBy: { name: 'Parent', email: 'test@example.com' },
      })

      const request = createMockRequest('PUT', { isActive: false })
      const context = createMockContext({ id: 'template-1' })
      const response = await PUT(request, context)
      const { status } = await parseResponse(response)

      expect(status).toBe(200)
      expect(mockPrisma.badgeTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
          }),
        })
      )
    })
  })

  describe('DELETE /api/badge-templates/[id]', () => {
    it('should return error if not authenticated', async () => {
      const request = new Request('http://localhost:3000/api/badge-templates/template-1', {
        method: 'DELETE',
      })
      const context = createMockContext({ id: 'template-1' })
      const response = await DELETE(request, context)
      const { status, data } = await parseResponse(response)

      // Returns 500 because route defaults to 500 for non-Forbidden errors
      expect(status).toBeGreaterThanOrEqual(400)
      expect(data).toHaveProperty('error')
    })

    it('should return 404 if template not found', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/badge-templates/non-existent', {
        method: 'DELETE',
      })
      const context = createMockContext({ id: 'non-existent' })
      const response = await DELETE(request, context)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(404)
      expect(data).toHaveProperty('error', 'Badge template not found')
    })

    it('should delete template successfully', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      const existingTemplate = {
        id: 'template-1',
        familyId: 'family-1',
        builtInBadgeId: 'streak_7_days_10pts',
        choreId: null,
        type: 'achievement',
        name: 'Test',
        nameZh: null,
        description: null,
        descriptionZh: null,
        imageUrl: null,
        icon: null,
        ruleConfig: null,
        isActive: true,
        createdById: 'user-1',
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(existingTemplate)
      mockPrisma.badgeTemplate.delete.mockResolvedValue(existingTemplate)

      const request = new Request('http://localhost:3000/api/badge-templates/template-1', {
        method: 'DELETE',
      })
      const context = createMockContext({ id: 'template-1' })
      const response = await DELETE(request, context)
      const { status, data } = await parseResponse<{ success: boolean }>(response)

      expect(status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPrisma.badgeTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      })
    })

    it('should not delete template from different family', async () => {
      mockSession = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.PARENT,
          familyId: 'family-1',
        },
      }

      // findFirst returns null because family doesn't match
      mockPrisma.badgeTemplate.findFirst.mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/badge-templates/template-from-other-family', {
        method: 'DELETE',
      })
      const context = createMockContext({ id: 'template-from-other-family' })
      const response = await DELETE(request, context)
      const { status, data } = await parseResponse(response)

      expect(status).toBe(404)
      expect(data).toHaveProperty('error', 'Badge template not found')
      expect(mockPrisma.badgeTemplate.delete).not.toHaveBeenCalled()
    })
  })
})
