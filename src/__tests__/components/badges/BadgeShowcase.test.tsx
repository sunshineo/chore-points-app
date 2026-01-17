import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BadgeShowcase from '@/components/badges/BadgeShowcase'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      myBadges: 'My Badges',
      progress: 'Progress',
      maxLevel: 'Max Level Reached!',
    }
    return translations[key] || key
  },
  useLocale: () => 'en',
}))

// Mock fetch
global.fetch = vi.fn()

describe('BadgeShowcase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReset()
  })

  const mockBadgesResponse = {
    badges: [
      {
        id: 'badge-1',
        count: 15,
        level: 2,
        levelName: 'Bronze',
        levelIcon: '🥉',
        progress: 50,
        nextLevelAt: 20,
        lastLevelUpAt: null,
        chore: {
          id: 'chore-1',
          title: 'Clean Room',
          icon: '🧹',
        },
        customImageUrl: null,
        customIcon: null,
      },
    ],
    achievementBadges: [
      {
        id: 'earned-1',
        badgeId: 'first_chore',
        earnedAt: '2024-01-15T10:00:00Z',
        name: 'Getting Started',
        nameZh: '初出茅庐',
        description: 'Completed your first chore',
        descriptionZh: '完成了第一个家务',
        icon: '🎉',
        customImageUrl: null,
      },
    ],
    allAchievementBadges: [
      {
        id: 'first_chore',
        name: 'Getting Started',
        nameZh: '初出茅庐',
        description: 'Completed your first chore',
        descriptionZh: '完成了第一个家务',
        icon: '🎉',
        customImageUrl: null,
      },
      {
        id: 'streak_7_days_10pts',
        name: 'Week Warrior',
        nameZh: '周冠军',
        description: 'Earned 10+ points every day for 7 days',
        descriptionZh: '连续7天每天获得10分以上',
        icon: '🔥',
        customImageUrl: null,
      },
    ],
  }

  it('should show loading skeleton initially', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<BadgeShowcase />)

    // Should show multiple skeleton items
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should fetch badges on mount', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/badges')
    })
  })

  it('should fetch badges with kidId when provided', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase kidId="kid-123" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/badges?kidId=kid-123')
    })
  })

  it('should render all achievement badges', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument()
      expect(screen.getByText('Week Warrior')).toBeInTheDocument()
    })
  })

  it('should render earned chore badges', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(screen.getByText('Clean Room')).toBeInTheDocument()
    })
  })

  it('should show count indicator for chore badges with count > 1', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(screen.getByText('15x')).toBeInTheDocument()
    })
  })

  it('should apply grayscale to unearned achievement badges', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      // Week Warrior is not earned
      const weekWarriorButton = screen.getByText('Week Warrior').closest('button')
      expect(weekWarriorButton?.querySelector('.grayscale')).toBeInTheDocument()
    })
  })

  it('should not apply grayscale to earned achievement badges', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      // Getting Started is earned
      const gettingStartedButton = screen.getByText('Getting Started').closest('button')
      // The outer div should not have grayscale (check for empty class condition)
      const outerDiv = gettingStartedButton?.querySelector('div')
      expect(outerDiv?.className).not.toContain('grayscale opacity-30')
    })
  })

  it('should open modal when clicking on a badge', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(screen.getByText('Clean Room')).toBeInTheDocument()
    })

    // Click on the Clean Room badge
    const cleanRoomButton = screen.getByText('Clean Room').closest('button')
    if (cleanRoomButton) {
      fireEvent.click(cleanRoomButton)
    }

    // Modal should appear with badge details
    await waitFor(() => {
      // Look for modal content (badge name appears twice - in grid and modal)
      const cleanRoomTexts = screen.getAllByText('Clean Room')
      expect(cleanRoomTexts.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('should close modal when clicking close', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockBadgesResponse),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument()
    })

    // Click on badge to open modal
    const badge = screen.getByText('Getting Started').closest('button')
    if (badge) {
      fireEvent.click(badge)
    }

    // Wait for modal
    await waitFor(() => {
      const backdrop = document.querySelector('.fixed.inset-0')
      expect(backdrop).toBeInTheDocument()
    })

    // Click backdrop to close
    const backdrop = document.querySelector('.fixed.inset-0')
    if (backdrop) {
      fireEvent.click(backdrop)
    }

    // Modal should be closed - only one instance of badge name
    await waitFor(() => {
      const gettingStartedTexts = screen.getAllByText('Getting Started')
      expect(gettingStartedTexts).toHaveLength(1)
    })
  })

  it('should handle empty badges gracefully', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        badges: [],
        achievementBadges: [],
        allAchievementBadges: [],
      }),
    })

    render(<BadgeShowcase />)

    await waitFor(() => {
      // Should not crash, just render empty grid
      expect(document.querySelector('.grid')).toBeInTheDocument()
    })
  })

  it('should handle fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    )

    render(<BadgeShowcase />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch badges:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })
})
