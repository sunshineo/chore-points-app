import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role, Family } from '@prisma/client'

let mockSession: { user: { id: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireParentInFamily: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (mockSession.user.role !== 'PARENT') throw new Error('Forbidden')
    if (!mockSession.user.familyId) throw new Error('Forbidden')
    return mockSession
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    family: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { GET } from '@/app/api/hue/status/route'
import { DELETE } from '@/app/api/hue/disconnect/route'
import { prisma } from '@/lib/db'

const mockPrisma = vi.mocked(prisma)

type PartialFamily = Partial<Family>

describe('Hue Status and Disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/hue/status', () => {
    it('should return connected=false when not connected', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }

      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'family-1',
        hueAccessToken: null,
      } as PartialFamily as Family)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.connected).toBe(false)
    })

    it('should return connected=true when connected', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }

      mockPrisma.family.findUnique.mockResolvedValue({
        id: 'family-1',
        hueAccessToken: 'token',
        hueUsername: 'username',
      } as PartialFamily as Family)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.connected).toBe(true)
    })
  })

  describe('DELETE /api/hue/disconnect', () => {
    it('should clear Hue tokens', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }

      mockPrisma.family.update.mockResolvedValue({} as PartialFamily as Family)

      const response = await DELETE()

      expect(response.status).toBe(200)
      expect(mockPrisma.family.update).toHaveBeenCalledWith({
        where: { id: 'family-1' },
        data: {
          hueAccessToken: null,
          hueRefreshToken: null,
          hueTokenExpiry: null,
          hueUsername: null,
        },
      })
    })
  })
})
