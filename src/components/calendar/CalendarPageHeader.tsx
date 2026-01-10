"use client";

import { useTranslations } from "next-intl";

export default function CalendarPageHeader() {
  const t = useTranslations("calendar");

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
      <p className="text-gray-500 mt-1">{t("pageDesc")}</p>
    </div>
  );
}
