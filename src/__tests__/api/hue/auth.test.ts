import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role } from '@prisma/client'

let mockSession: { user: { id: string; role: Role; familyId: string | null } } | null = null

vi.mock('@/lib/permissions', () => ({
  requireParentInFamily: vi.fn(() => {
    if (!mockSession) throw new Error('Unauthorized')
    if (mockSession.user.role !== 'PARENT') throw new Error('Forbidden')
    if (!mockSession.user.familyId) throw new Error('Forbidden')
    return mockSession
  }),
}))

vi.mock('@/lib/hue', () => ({
  getHueAuthUrl: vi.fn(() => 'https://api.meethue.com/oauth?test=1'),
  exchangeCodeForTokens: vi.fn(),
  linkHueBridge: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    family: {
      update: vi.fn(),
    },
  },
}))

import { GET as authGET } from '@/app/api/hue/auth/route'
import { GET as callbackGET } from '@/app/api/hue/callback/route'
import { exchangeCodeForTokens, linkHueBridge } from '@/lib/hue'
import { prisma } from '@/lib/db'

const mockExchange = vi.mocked(exchangeCodeForTokens)
const mockLink = vi.mocked(linkHueBridge)
const mockPrisma = vi.mocked(prisma)

describe('Hue OAuth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/hue/auth', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await authGET()
      expect(response.status).toBe(401)
    })

    it('should return redirect URL for authenticated parent', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }

      const response = await authGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.url).toContain('meethue.com')
    })
  })

  describe('GET /api/hue/callback', () => {
    it('should return 400 if no code provided', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }

      const request = new Request('http://localhost/api/hue/callback')
      const response = await callbackGET(request)

      expect(response.status).toBe(400)
    })

    it('should exchange code and store tokens', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }

      mockExchange.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 604800,
      })

      mockLink.mockResolvedValue('hue-username')
      mockPrisma.family.update.mockResolvedValue({} as never)

      const request = new Request(
        'http://localhost/api/hue/callback?code=auth-code&state=family-1'
      )
      const response = await callbackGET(request)

      expect(response.status).toBe(307)
      expect(mockPrisma.family.update).toHaveBeenCalledWith({
        where: { id: 'family-1' },
        data: expect.objectContaining({
          hueAccessToken: 'access-token',
          hueRefreshToken: 'refresh-token',
          hueUsername: 'hue-username',
        }),
      })
    })
  })
})
