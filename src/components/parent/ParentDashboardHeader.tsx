"use client";

import { useTranslations } from "next-intl";
import FamilyInviteCode from "@/components/family/FamilyInviteCode";

type ParentDashboardHeaderProps = {
  familyName?: string | null;
  kidsCount: number;
  kidsNames: string;
  inviteCode: string;
};

export default function ParentDashboardHeader({
  familyName,
  kidsCount,
  kidsNames,
  inviteCode,
}: ParentDashboardHeaderProps) {
  const t = useTranslations("parent");

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">{t("dashboard")}</h1>
      <p className="mt-2 text-gray-600">{t("dashboardDesc")}</p>

      {/* Family Info Card Header */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {familyName || t("yourFamily")}
            </h2>
            <p className="text-sm text-gray-500">
              {kidsCount === 0
                ? t("noKidsYet")
                : `${kidsCount} ${kidsCount > 1 ? "kids" : "kid"}: ${kidsNames}`}
            </p>
          </div>
          <FamilyInviteCode inviteCode={inviteCode} />
        </div>
      </div>
    </>
  );
}
