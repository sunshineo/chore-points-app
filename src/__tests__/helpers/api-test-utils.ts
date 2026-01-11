import { vi } from 'vitest'

// Helper to create a mock request
export function createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  options: {
    url?: string
    headers?: Record<string, string>
  } = {}
): Request {
  const { url = 'http://localhost:3000/api/test', headers = {} } = options

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    requestInit.body = JSON.stringify(body)
  }

  return new Request(url, requestInit)
}

// Helper to parse response
export async function parseResponse<T = unknown>(response: Response): Promise<{
  status: number
  data: T
}> {
  const data = await response.json() as T
  return { status: response.status, data }
}

// Create a mock context for route handlers with params
export function createMockContext(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return {
    params: Promise.resolve(params),
  }
}
