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
  getHueRooms: vi.fn(),
  controlHueRoom: vi.fn(),
}))

import { GET } from '@/app/api/hue/rooms/route'
import { PUT } from '@/app/api/hue/rooms/[id]/route'
import { getHueAccessToken, getHueRooms, controlHueRoom } from '@/lib/hue'

const mockGetToken = vi.mocked(getHueAccessToken)
const mockGetRooms = vi.mocked(getHueRooms)
const mockControl = vi.mocked(controlHueRoom)

describe('Hue Rooms API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession = null
  })

  describe('GET /api/hue/rooms', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await GET()
      expect(response.status).toBe(401)
    })

    it('should return 400 if Hue not connected', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }
      mockGetToken.mockResolvedValue(null)

      const response = await GET()
      expect(response.status).toBe(400)
    })

    it('should return rooms list', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }
      mockGetToken.mockResolvedValue({
        accessToken: 'token',
        username: 'user',
      })
      mockGetRooms.mockResolvedValue([
        { id: '1', name: 'Living Room', type: 'Room', on: true, brightness: 80 },
        { id: '2', name: 'Bedroom', type: 'Room', on: false, brightness: 0 },
      ])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rooms).toHaveLength(2)
      expect(data.rooms[0].name).toBe('Living Room')
    })
  })

  describe('PUT /api/hue/rooms/[id]', () => {
    it('should control room on/off', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }
      mockGetToken.mockResolvedValue({
        accessToken: 'token',
        username: 'user',
      })
      mockControl.mockResolvedValue(undefined)

      const request = createMockRequest('PUT', { on: false })
      const context = createMockContext({ id: '1' })
      const response = await PUT(request, context)

      expect(response.status).toBe(200)
      expect(mockControl).toHaveBeenCalledWith('token', 'user', '1', { on: false })
    })

    it('should control room brightness', async () => {
      mockSession = {
        user: { id: 'user-1', role: Role.PARENT, familyId: 'family-1' },
      }
      mockGetToken.mockResolvedValue({
        accessToken: 'token',
        username: 'user',
      })
      mockControl.mockResolvedValue(undefined)

      const request = createMockRequest('PUT', { brightness: 50 })
      const context = createMockContext({ id: '1' })
      const response = await PUT(request, context)

      expect(response.status).toBe(200)
      expect(mockControl).toHaveBeenCalledWith('token', 'user', '1', { brightness: 50 })
    })
  })
})
