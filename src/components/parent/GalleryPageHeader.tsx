"use client";

import { useTranslations } from "next-intl";

export default function GalleryPageHeader() {
  const t = useTranslations("photos");

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
      <p className="mt-1 text-gray-600">{t("pageDesc")}</p>
    </div>
  );
}
