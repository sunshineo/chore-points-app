"use client";

import { useTranslations } from "next-intl";

export default function MealsPageHeader() {
  const t = useTranslations("meals");

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">{t("pageTitle")}</h1>
      <p className="mt-2 text-gray-600">{t("pageDesc")}</p>
    </>
  );
}
