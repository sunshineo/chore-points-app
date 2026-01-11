import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FamilyInviteCode from '@/components/family/FamilyInviteCode'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      familyInviteCode: 'Family Invite Code',
      showCode: 'Show Code',
      copied: 'Copied!',
      copy: 'Copy',
      generateNewCode: 'Generate New Code',
      shareCodeHint: 'Share this code with family members to let them join',
    }
    return translations[key] || key
  },
}))

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn(() => Promise.resolve()),
}
Object.assign(navigator, { clipboard: mockClipboard })

// Mock fetch
global.fetch = vi.fn()

describe('FamilyInviteCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReset()
    mockClipboard.writeText.mockClear()
  })

  it('should render with hidden code initially', () => {
    render(<FamilyInviteCode inviteCode="ABC123" />)

    expect(screen.getByText('Family Invite Code')).toBeInTheDocument()
    expect(screen.getByText('Show Code')).toBeInTheDocument()
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument()
  })

  it('should show code when Show Code button is clicked', async () => {
    render(<FamilyInviteCode inviteCode="ABC123" />)

    const showButton = screen.getByText('Show Code')
    await userEvent.click(showButton)

    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.queryByText('Show Code')).not.toBeInTheDocument()
  })

  it('should copy code to clipboard', async () => {
    render(<FamilyInviteCode inviteCode="ABC123" />)

    const copyButton = screen.getByText('Copy')
    await userEvent.click(copyButton)

    expect(mockClipboard.writeText).toHaveBeenCalledWith('ABC123')
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('should show share hint when code is visible', async () => {
    render(<FamilyInviteCode inviteCode="ABC123" />)

    expect(screen.queryByText('Share this code with family members to let them join')).not.toBeInTheDocument()

    const showButton = screen.getByText('Show Code')
    await userEvent.click(showButton)

    expect(screen.getByText('Share this code with family members to let them join')).toBeInTheDocument()
  })

  it('should refresh invite code when refresh button is clicked', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ inviteCode: 'NEW456' }),
    })

    render(<FamilyInviteCode inviteCode="ABC123" />)

    // Show the code first
    await userEvent.click(screen.getByText('Show Code'))
    expect(screen.getByText('ABC123')).toBeInTheDocument()

    // Click refresh button (the SVG button)
    const refreshButton = screen.getByTitle('Generate New Code')
    await userEvent.click(refreshButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/family/refresh-code', {
        method: 'POST',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('NEW456')).toBeInTheDocument()
    })
  })

  it('should handle refresh error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

    render(<FamilyInviteCode inviteCode="ABC123" />)

    // Show the code first
    await userEvent.click(screen.getByText('Show Code'))

    // Click refresh button
    const refreshButton = screen.getByTitle('Generate New Code')
    await userEvent.click(refreshButton)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
    })

    // Code should remain unchanged
    expect(screen.getByText('ABC123')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('should disable refresh button while refreshing', async () => {
    let resolvePromise: (value: unknown) => void
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(fetchPromise)

    render(<FamilyInviteCode inviteCode="ABC123" />)

    const refreshButton = screen.getByTitle('Generate New Code')
    await userEvent.click(refreshButton)

    // Button should be disabled during refresh
    expect(refreshButton).toBeDisabled()

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ inviteCode: 'NEW456' }),
    })

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled()
    })
  })
})
