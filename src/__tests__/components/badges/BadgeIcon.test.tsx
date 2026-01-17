import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BadgeIcon from '@/components/badges/BadgeIcon'

describe('BadgeIcon', () => {
  describe('rendering emoji', () => {
    it('should render emoji when no imageUrl provided', () => {
      render(<BadgeIcon emoji="🏆" alt="Trophy" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toBeInTheDocument()
    })

    it('should render default emoji when neither imageUrl nor emoji provided', () => {
      render(<BadgeIcon alt="Default" />)

      const emoji = screen.getByText('🏅')
      expect(emoji).toBeInTheDocument()
    })

    it('should render null emoji as default', () => {
      render(<BadgeIcon emoji={null} alt="Null emoji" />)

      const emoji = screen.getByText('🏅')
      expect(emoji).toBeInTheDocument()
    })
  })

  describe('rendering image', () => {
    it('should render image when imageUrl is provided', () => {
      render(<BadgeIcon imageUrl="https://example.com/badge.png" alt="Custom Badge" />)

      const image = screen.getByRole('img', { name: 'Custom Badge' })
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', 'https://example.com/badge.png')
    })

    it('should prefer image over emoji when both provided', () => {
      render(
        <BadgeIcon
          imageUrl="https://example.com/badge.png"
          emoji="🏆"
          alt="Badge"
        />
      )

      const image = screen.getByRole('img', { name: 'Badge' })
      expect(image).toBeInTheDocument()
      expect(screen.queryByText('🏆')).not.toBeInTheDocument()
    })

    it('should have rounded-full class on image', () => {
      render(<BadgeIcon imageUrl="https://example.com/badge.png" alt="Badge" />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('rounded-full')
    })
  })

  describe('size variants', () => {
    it('should apply sm size classes', () => {
      render(<BadgeIcon emoji="🏆" size="sm" alt="Small" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toHaveClass('w-6', 'h-6', 'text-lg')
    })

    it('should apply md size classes (default)', () => {
      render(<BadgeIcon emoji="🏆" alt="Medium" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toHaveClass('w-8', 'h-8', 'text-2xl')
    })

    it('should apply lg size classes', () => {
      render(<BadgeIcon emoji="🏆" size="lg" alt="Large" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toHaveClass('w-12', 'h-12', 'text-3xl')
    })

    it('should apply xl size classes', () => {
      render(<BadgeIcon emoji="🏆" size="xl" alt="Extra Large" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toHaveClass('w-14', 'h-14', 'text-4xl')
    })

    it('should apply 2xl size classes', () => {
      render(<BadgeIcon emoji="🏆" size="2xl" alt="2XL" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toHaveClass('w-20', 'h-20', 'text-6xl')
    })

    it('should apply size classes to image', () => {
      render(<BadgeIcon imageUrl="https://example.com/badge.png" size="lg" alt="Large" />)

      const image = screen.getByRole('img')
      expect(image).toHaveClass('w-12', 'h-12')
    })
  })

  describe('custom className', () => {
    it('should apply custom className to emoji', () => {
      render(<BadgeIcon emoji="🏆" className="custom-class" alt="Custom" />)

      const emoji = screen.getByText('🏆')
      expect(emoji).toHaveClass('custom-class')
    })

    it('should apply custom className to image', () => {
      render(
        <BadgeIcon
          imageUrl="https://example.com/badge.png"
          className="grayscale opacity-50"
          alt="Filtered"
        />
      )

      const image = screen.getByRole('img')
      expect(image).toHaveClass('grayscale', 'opacity-50')
    })
  })

  describe('accessibility', () => {
    it('should use default alt text', () => {
      render(<BadgeIcon imageUrl="https://example.com/badge.png" />)

      const image = screen.getByRole('img', { name: 'Badge' })
      expect(image).toBeInTheDocument()
    })

    it('should use custom alt text', () => {
      render(<BadgeIcon imageUrl="https://example.com/badge.png" alt="Week Warrior Badge" />)

      const image = screen.getByRole('img', { name: 'Week Warrior Badge' })
      expect(image).toBeInTheDocument()
    })
  })
})
