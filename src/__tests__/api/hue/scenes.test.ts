import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockRequest, createMockContext } from '../../helpers/api-test-utils'
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
  getHueAccessToken: vi.fn(),
  getHueScenes: vi.fn(),
  activateHueScene: vi.fn(),
}))

import { GET } from '@/app/api/hue/scenes/route'
import { POST } from '@/app/api/hue/scenes/[id]/activate/route'
import { getHueAccessToken, getHueScenes, activateHueScene } from '@/lib/hue'

const mockGetToken = vi.mocked(getHueAccessToken)
const mockGetScenes = vi.mocked(getHueScenes)
const mockActivate = vi.mocked(activateHueScene)

describe('Hue Scenes API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/hue/scenes', () => {
    it('should return scenes list', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }
      mockGetToken.mockResolvedValue({
        accessToken: 'token',
        username: 'user',
      })
      mockGetScenes.mockResolvedValue([
        { id: 's1', name: 'Relax', type: 'GroupScene', group: '1' },
        { id: 's2', name: 'Energize', type: 'GroupScene', group: '1' },
      ])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.scenes).toHaveLength(2)
    })
  })

  describe('POST /api/hue/scenes/[id]/activate', () => {
    it('should activate scene', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }
      mockGetToken.mockResolvedValue({
        accessToken: 'token',
        username: 'user',
      })
      mockActivate.mockResolvedValue(undefined)

      const request = createMockRequest('POST', { groupId: '1' })
      const context = createMockContext({ id: 's1' })
      const response = await POST(request, context)

      expect(response.status).toBe(200)
      expect(mockActivate).toHaveBeenCalledWith('token', 'user', 's1', '1')
    })
  })
})
