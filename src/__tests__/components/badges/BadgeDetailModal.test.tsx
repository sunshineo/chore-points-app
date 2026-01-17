import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BadgeDetailModal from '@/components/badges/BadgeDetailModal'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      progress: 'Progress',
      maxLevel: 'Max Level Reached!',
    }
    return translations[key] || key
  },
  useLocale: () => 'en',
}))

describe('BadgeDetailModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Achievement badge rendering', () => {
    const achievementBadge = {
      id: 'streak_7_days_10pts',
      name: 'Week Warrior',
      nameZh: '周冠军',
      description: 'Earned 10+ points every day for 7 days',
      descriptionZh: '连续7天每天获得10分以上',
      icon: '🔥',
    }

    it('should render earned achievement badge correctly', () => {
      const earnedBadge = {
        id: 'badge-instance-1',
        badgeId: 'streak_7_days_10pts',
        earnedAt: '2024-01-15T10:00:00Z',
        name: 'Week Warrior',
        nameZh: '周冠军',
        description: 'Earned 10+ points every day for 7 days',
        descriptionZh: '连续7天每天获得10分以上',
        icon: '🔥',
      }

      render(
        <BadgeDetailModal
          type="achievement"
          badge={achievementBadge}
          earned={true}
          earnedBadge={earnedBadge}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Week Warrior')).toBeInTheDocument()
      expect(screen.getByText('Earned 10+ points every day for 7 days')).toBeInTheDocument()
      expect(screen.getByText('🔥')).toBeInTheDocument()
      // Should show earned date
      expect(screen.getByText(/Jan/)).toBeInTheDocument()
    })

    it('should render unearned achievement badge with lock indicator', () => {
      render(
        <BadgeDetailModal
          type="achievement"
          badge={achievementBadge}
          earned={false}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Week Warrior')).toBeInTheDocument()
      expect(screen.getByText('Not yet earned')).toBeInTheDocument()
    })

    it('should apply grayscale to unearned badge', () => {
      render(
        <BadgeDetailModal
          type="achievement"
          badge={achievementBadge}
          earned={false}
          onClose={mockOnClose}
        />
      )

      // The badge container has grayscale class when not earned
      const badgeIcon = screen.getByText('🔥')
      // Check that somewhere in the component tree there's a grayscale element
      const grayscaleElement = document.querySelector('.grayscale')
      expect(grayscaleElement).toBeInTheDocument()
    })
  })

  describe('Chore badge rendering', () => {
    const choreBadge = {
      id: 'badge-1',
      count: 15,
      level: 2,
      levelName: 'Bronze',
      levelIcon: '🥉',
      progress: 50,
      nextLevelAt: 20,
      lastLevelUpAt: '2024-01-10T10:00:00Z',
      chore: {
        id: 'chore-1',
        title: 'Clean Room',
        icon: '🧹',
      },
    }

    it('should render chore badge with title and level', () => {
      render(
        <BadgeDetailModal
          type="chore"
          badge={choreBadge}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Clean Room')).toBeInTheDocument()
      expect(screen.getByText('🥉')).toBeInTheDocument()
      expect(screen.getByText('Bronze')).toBeInTheDocument()
    })

    it('should show progress bar', () => {
      render(
        <BadgeDetailModal
          type="chore"
          badge={choreBadge}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Progress')).toBeInTheDocument()
      expect(screen.getByText('15/20')).toBeInTheDocument()
    })

    it('should show times completed', () => {
      render(
        <BadgeDetailModal
          type="chore"
          badge={choreBadge}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Completed 15 times')).toBeInTheDocument()
    })

    it('should show singular "time" for count of 1', () => {
      render(
        <BadgeDetailModal
          type="chore"
          badge={{ ...choreBadge, count: 1 }}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Completed 1 time')).toBeInTheDocument()
    })

    it('should show count badge for count > 1', () => {
      render(
        <BadgeDetailModal
          type="chore"
          badge={choreBadge}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('15x')).toBeInTheDocument()
    })

    it('should not show count badge for count of 1', () => {
      render(
        <BadgeDetailModal
          type="chore"
          badge={{ ...choreBadge, count: 1 }}
          onClose={mockOnClose}
        />
      )

      expect(screen.queryByText('1x')).not.toBeInTheDocument()
    })

    it('should show max level indicator when at max level', () => {
      const maxLevelBadge = {
        ...choreBadge,
        level: 6,
        levelName: 'Super',
        levelIcon: '⭐',
        nextLevelAt: null,
        progress: 100,
      }

      render(
        <BadgeDetailModal
          type="chore"
          badge={maxLevelBadge}
          onClose={mockOnClose}
        />
      )

      expect(screen.getByText('Max Level Reached!')).toBeInTheDocument()
    })
  })

  describe('Modal interactions', () => {
    const achievementBadge = {
      id: 'test',
      name: 'Test Badge',
      nameZh: '测试徽章',
      icon: '🏆',
    }

    it('should call onClose when clicking backdrop', () => {
      render(
        <BadgeDetailModal
          type="achievement"
          badge={achievementBadge}
          earned={false}
          onClose={mockOnClose}
        />
      )

      // Click the backdrop (the outer fixed div)
      const backdrop = screen.getByText('Test Badge').closest('.fixed')
      if (backdrop) {
        fireEvent.click(backdrop)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })

    it('should not close when clicking modal content', () => {
      render(
        <BadgeDetailModal
          type="achievement"
          badge={achievementBadge}
          earned={false}
          onClose={mockOnClose}
        />
      )

      // Click on the badge name (inside the modal)
      fireEvent.click(screen.getByText('Test Badge'))
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should call onClose when pressing Escape', () => {
      render(
        <BadgeDetailModal
          type="achievement"
          badge={achievementBadge}
          earned={false}
          onClose={mockOnClose}
        />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
