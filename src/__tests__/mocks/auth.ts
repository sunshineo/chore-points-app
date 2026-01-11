import { vi } from 'vitest'
import { Role } from '@prisma/client'

// Type definitions for session
export interface MockUser {
  id: string
  email: string
  name: string | null
  role: Role
  familyId: string | null
}

export interface MockSession {
  user: MockUser
  expires: string
}

// Factory functions for creating mock data
export function createMockParent(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'parent-1',
    email: 'parent@example.com',
    name: 'Test Parent',
    role: Role.PARENT,
    familyId: 'family-1',
    ...overrides,
  }
}

export function createMockKid(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'kid-1',
    email: 'kid@example.com',
    name: 'Test Kid',
    role: Role.KID,
    familyId: 'family-1',
    ...overrides,
  }
}

export function createMockSession(user: MockUser): MockSession {
  return {
    user,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

// Mock session state
let mockSession: MockSession | null = null

export function setMockSession(session: MockSession | null) {
  mockSession = session
}

export function getMockSession(): MockSession | null {
  return mockSession
}

// Mock auth function
export const mockAuth = vi.fn(() => Promise.resolve(mockSession))

// Reset auth mocks
export function resetAuthMocks() {
  mockSession = null
  mockAuth.mockReset()
  mockAuth.mockImplementation(() => Promise.resolve(mockSession))
}
