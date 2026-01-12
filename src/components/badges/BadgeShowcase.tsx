"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BADGE_LEVELS } from "@/lib/badges";

type Badge = {
  id: string;
  count: number;
  level: number;
  levelName: string | null;
  levelIcon: string | null;
  progress: number;
  nextLevelAt: number | null;
  lastLevelUpAt: string | null;
  chore: {
    id: string;
    title: string;
    icon: string | null;
  };
};

type AchievementBadge = {
  id: string;
  badgeId: string;
  earnedAt: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
};

// Level-specific colors
const levelColors: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "bg-green-100", border: "border-green-300", text: "text-green-700" },
  2: { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-700" },
  3: { bg: "bg-gray-200", border: "border-gray-400", text: "text-gray-700" },
  4: { bg: "bg-yellow-100", border: "border-yellow-500", text: "text-yellow-700" },
  5: { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700" },
  6: { bg: "bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200", border: "border-yellow-500", text: "text-orange-700" },
};

type BadgeShowcaseProps = {
  kidId?: string;
};

export default function BadgeShowcase({ kidId }: BadgeShowcaseProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievementBadges, setAchievementBadges] = useState<AchievementBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations("badges");
  const locale = useLocale();

  useEffect(() => {
    fetchBadges();
  }, [kidId]);

  const fetchBadges = async () => {
    try {
      const url = kidId ? `/api/badges?kidId=${kidId}` : "/api/badges";
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        setBadges(data.badges || []);
        setAchievementBadges(data.achievementBadges || []);
      }
    } catch (error) {
      console.error("Failed to fetch badges:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-32 h-24 bg-gray-100 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  const totalBadges = badges.length + achievementBadges.length;

  if (totalBadges === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-xl">
        <div className="text-4xl mb-2">🏅</div>
        <p className="text-gray-500 text-sm">{t("noBadgesYet")}</p>
        <p className="text-gray-400 text-xs mt-1">{t("startEarning")}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-gray-300">
      {/* Achievement Badges (special achievements first) */}
      {achievementBadges.map((badge) => {
        const isNew =
          new Date(badge.earnedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;

        return (
          <div
            key={badge.id}
            className="flex-shrink-0 relative bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl p-3 border-2 border-indigo-300
              min-w-[140px] shadow-sm hover:shadow-md transition-shadow"
          >
            {/* New indicator */}
            {isNew && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}

            {/* Content */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{badge.icon}</span>
              <span className="text-xs bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                Achievement
              </span>
            </div>

            <div className="text-xs font-medium text-gray-900 truncate mb-1">
              {locale === "zh" ? badge.nameZh : badge.name}
            </div>

            <div className="text-xs text-indigo-600 truncate" title={locale === "zh" ? badge.descriptionZh : badge.description}>
              {locale === "zh" ? badge.descriptionZh : badge.description}
            </div>
          </div>
        );
      })}

      {/* Chore Badges */}
      {badges.map((badge) => {
        const colors = levelColors[badge.level] || levelColors[1];
        const isMaxLevel = badge.level === BADGE_LEVELS.length;
        const isNew =
          badge.lastLevelUpAt &&
          new Date(badge.lastLevelUpAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;

        return (
          <div
            key={badge.id}
            className={`flex-shrink-0 relative ${colors.bg} rounded-xl p-3 border-2 ${colors.border}
              min-w-[140px] shadow-sm hover:shadow-md transition-shadow`}
          >
            {/* New indicator */}
            {isNew && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}

            {/* Content */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{badge.chore.icon || "✨"}</span>
              <span className="text-lg">{badge.levelIcon}</span>
            </div>

            <div className="text-xs font-medium text-gray-900 truncate mb-1">
              {badge.chore.title}
            </div>

            <div className={`text-xs font-semibold ${colors.text}`}>
              {badge.levelName}
            </div>

            {/* Progress mini bar */}
            {!isMaxLevel && (
              <div className="mt-2 h-1 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${badge.progress}%` }}
                />
              </div>
            )}

            {isMaxLevel && (
              <div className="mt-2 text-xs text-center">⭐</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
