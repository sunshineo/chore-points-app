"use client";

import { useTranslations } from "next-intl";

export default function KidPointsHeader() {
  const t = useTranslations("points");

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">{t("myPoints")}</h1>
    </div>
  );
}
