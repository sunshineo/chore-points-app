import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, parseResponse } from '../../helpers/api-test-utils'
import { Role } from '@prisma/client'

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  sensitiveRateLimiter: {
    check: vi.fn(() => ({ success: true })),
  },
  checkRateLimit: vi.fn(() => null),
}))

// Mock session
let mockSession: { user: { id: string; email: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    return mockSession
  }),
}))

// Mock Prisma - define inside the factory to avoid hoisting issues
vi.mock('@/lib/db', () => {
  return {
    prisma: {
      family: {
        findUnique: vi.fn(),
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
import { POST } from '@/app/api/family/join/route'

describe('POST /api/family/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  it('should return 400 if invite code is missing', async () => {
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
    expect(data).toHaveProperty('error', 'Invite code is required')
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

    const request = createMockRequest('POST', { inviteCode: 'ABC123' })
    const response = await POST(request)
    const { status, data } = await parseResponse(response)

    expect(status).toBe(400)
    expect(data).toHaveProperty('error', 'You are already part of a family')
  })

  it('should return 404 for invalid invite code', async () => {
    mockSession = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        role: Role.PARENT,
        familyId: null,
      },
    }

    mockPrisma.family.findUnique.mockResolvedValue(null)

    const request = createMockRequest('POST', { inviteCode: 'INVALID' })
    const response = await POST(request)
    const { status, data } = await parseResponse(response)

    expect(status).toBe(404)
    expect(data).toHaveProperty('error', 'Invalid invite code')
  })

  it('should join family successfully with valid invite code', async () => {
    mockSession = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        role: Role.PARENT,
        familyId: null,
      },
    }

    mockPrisma.family.findUnique.mockResolvedValue({
      id: 'family-1',
      name: 'Test Family',
      inviteCode: 'ABC123',
    })

    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: Role.PARENT,
      familyId: 'family-1',
    })

    const request = createMockRequest('POST', { inviteCode: 'ABC123' })
    const response = await POST(request)
    const { status, data } = await parseResponse<{ success: boolean; family: { id: string }; user: { familyId: string } }>(response)

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.family.id).toBe('family-1')
    expect(data.user.familyId).toBe('family-1')
  })

  it('should preserve user role when joining family', async () => {
    mockSession = {
      user: {
        id: 'kid-1',
        email: 'kid@example.com',
        role: Role.KID,
        familyId: null,
      },
    }

    mockPrisma.family.findUnique.mockResolvedValue({
      id: 'family-1',
      name: 'Test Family',
      inviteCode: 'ABC123',
    })

    mockPrisma.user.update.mockResolvedValue({
      id: 'kid-1',
      email: 'kid@example.com',
      name: 'Kid User',
      role: Role.KID,
      familyId: 'family-1',
    })

    const request = createMockRequest('POST', { inviteCode: 'ABC123' })
    const response = await POST(request)
    const { status, data } = await parseResponse<{ user: { role: Role } }>(response)

    expect(status).toBe(200)
    expect(data.user.role).toBe(Role.KID)
  })
})
