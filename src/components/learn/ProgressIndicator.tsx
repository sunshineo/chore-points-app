"use client";

import { useTranslations } from "next-intl";

type Props = {
  sightWordComplete: boolean;
  mathComplete: boolean;
};

export default function ProgressIndicator({
  sightWordComplete,
  mathComplete,
}: Props) {
  const t = useTranslations("learn");

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {/* Step 1: Sight Word */}
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            sightWordComplete
              ? "bg-green-500 text-white"
              : "bg-blue-500 text-white"
          }`}
        >
          {sightWordComplete ? "✓" : "1"}
        </div>
        <span
          className={`text-sm font-medium ${
            sightWordComplete ? "text-green-600" : "text-gray-700"
          }`}
        >
          {t("sightWord")}
        </span>
      </div>

      {/* Connector */}
      <div
        className={`w-8 h-1 rounded ${
          sightWordComplete ? "bg-green-500" : "bg-gray-300"
        }`}
      />

      {/* Step 2: Math */}
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            mathComplete
              ? "bg-green-500 text-white"
              : sightWordComplete
              ? "bg-orange-500 text-white"
              : "bg-gray-300 text-gray-500"
          }`}
        >
          {mathComplete ? "✓" : "2"}
        </div>
        <span
          className={`text-sm font-medium ${
            mathComplete
              ? "text-green-600"
              : sightWordComplete
              ? "text-gray-700"
              : "text-gray-400"
          }`}
        >
          {t("math")}
        </span>
      </div>
    </div>
  );
}
