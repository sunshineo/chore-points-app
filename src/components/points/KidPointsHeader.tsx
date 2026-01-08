"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type KidPointsHeaderProps = {
  totalPoints?: number;
};

export default function KidPointsHeader({ totalPoints }: KidPointsHeaderProps) {
  const t = useTranslations("points");

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("myPoints")}</h1>
          <p className="mt-2 text-gray-600">
            {t("trackPoints")}
          </p>
        </div>
        {/* Mario-style Coin Counter */}
        {totalPoints !== undefined && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2 rounded-full shadow-lg">
            <span className="text-2xl animate-bounce" style={{ animationDuration: "1s" }}>
              🪙
            </span>
            <span className="text-2xl font-bold text-white drop-shadow-md font-mono">
              × {totalPoints}
            </span>
          </div>
        )}
      </div>
      <Link
        href="/redeem"
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
      >
        {t("redeemRewards")}
      </Link>
    </div>
  );
}
