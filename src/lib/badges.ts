export const BADGE_LEVELS = [
  { level: 1, threshold: 1, name: 'Starter', icon: '🌱' },
  { level: 2, threshold: 10, name: 'Bronze', icon: '🥉' },
  { level: 3, threshold: 20, name: 'Silver', icon: '🥈' },
  { level: 4, threshold: 30, name: 'Gold', icon: '🥇' },
  { level: 5, threshold: 40, name: 'Platinum', icon: '💎' },
  { level: 6, threshold: 50, name: 'Super', icon: '⭐' },
] as const;

export type BadgeLevel = (typeof BADGE_LEVELS)[number];

export function calculateLevel(count: number): number {
  for (let i = BADGE_LEVELS.length - 1; i >= 0; i--) {
    if (count >= BADGE_LEVELS[i].threshold) {
      return BADGE_LEVELS[i].level;
    }
  }
  return 0;
}

export function getLevelInfo(level: number): BadgeLevel | null {
  return BADGE_LEVELS.find((l) => l.level === level) || null;
}

export function getNextLevelInfo(level: number): BadgeLevel | null {
  return BADGE_LEVELS.find((l) => l.level === level + 1) || null;
}

export function getProgressToNextLevel(count: number): {
  current: number;
  next: number | null;
  progress: number;
} {
  const currentLevel = calculateLevel(count);
  const nextLevelInfo = getNextLevelInfo(currentLevel);

  if (!nextLevelInfo) {
    // Already at max level
    return { current: count, next: null, progress: 100 };
  }

  const currentLevelInfo = getLevelInfo(currentLevel);
  const currentThreshold = currentLevelInfo?.threshold || 0;
  const nextThreshold = nextLevelInfo.threshold;

  const progressInLevel = count - currentThreshold;
  const levelRange = nextThreshold - currentThreshold;
  const progress = Math.round((progressInLevel / levelRange) * 100);

  return {
    current: count,
    next: nextThreshold,
    progress: Math.min(progress, 100),
  };
}
