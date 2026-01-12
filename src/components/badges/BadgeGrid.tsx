"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import BadgeCard from "./BadgeCard";

type Badge = {
  id: string;
  count: number;
  level: number;
  levelName: string | null;
  levelIcon: string | null;
  progress: number;
  nextLevelAt: number | null;
  lastLevelUpAt: string | null;
  kid: {
    id: string;
    name: string | null;
  };
  chore: {
    id: string;
    title: string;
    icon: string | null;
  };
};

type Kid = {
  id: string;
  name: string | null;
  email: string;
};

type BadgeGridProps = {
  kidId?: string;
  kids?: Kid[];
  showKidFilter?: boolean;
};

export default function BadgeGrid({ kidId, kids, showKidFilter = false }: BadgeGridProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKidId, setFilterKidId] = useState<string>(kidId || "");
  const t = useTranslations("badges");

  useEffect(() => {
    fetchBadges();
  }, [filterKidId]);

  const fetchBadges = async () => {
    try {
      const url = filterKidId
        ? `/api/badges?kidId=${filterKidId}`
        : "/api/badges";
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        setBadges(data.badges);
      }
    } catch (error) {
      console.error("Failed to fetch badges:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gray-100 rounded-xl p-4 animate-pulse h-40"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header with filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t("title")}</h2>
        {showKidFilter && kids && kids.length > 1 && (
          <select
            value={filterKidId}
            onChange={(e) => setFilterKidId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Kids</option>
            {kids.map((kid) => (
              <option key={kid.id} value={kid.id}>
                {kid.name || kid.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state */}
      {badges.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">🏅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t("noBadgesYet")}
          </h3>
          <p className="text-gray-500">{t("startEarning")}</p>
        </div>
      ) : (
        /* Badge grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              showKidName={showKidFilter && !filterKidId && kids && kids.length > 1}
              kidName={badge.kid.name || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
