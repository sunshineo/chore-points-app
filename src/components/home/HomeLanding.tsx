"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function HomeLanding() {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-400 via-pink-300 to-yellow-200 overflow-hidden">
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-6xl animate-bounce" style={{ animationDelay: "0s", animationDuration: "3s" }}>
          ⭐
        </div>
        <div className="absolute top-40 right-20 text-5xl animate-bounce" style={{ animationDelay: "0.5s", animationDuration: "2.5s" }}>
          💎
        </div>
        <div className="absolute top-60 left-1/4 text-4xl animate-bounce" style={{ animationDelay: "1s", animationDuration: "3.5s" }}>
          🏆
        </div>
        <div className="absolute bottom-40 right-1/4 text-5xl animate-bounce" style={{ animationDelay: "1.5s", animationDuration: "2.8s" }}>
          🎁
        </div>
        <div className="absolute bottom-60 left-20 text-4xl animate-bounce" style={{ animationDelay: "0.8s", animationDuration: "3.2s" }}>
          🌟
        </div>
        <div className="absolute top-1/3 right-10 text-5xl animate-bounce" style={{ animationDelay: "2s", animationDuration: "2.7s" }}>
          ✨
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          {/* Animated Logo/Icon */}
          <div className="mb-6 inline-block">
            <div className="text-8xl animate-pulse">
              💎
            </div>
          </div>

          {/* App Name */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-4 drop-shadow-lg">
            {tNav("appName")}
          </h1>

          {/* Tagline */}
          <p className="text-xl sm:text-2xl text-white/90 mb-8 font-medium drop-shadow">
            {t("tagline")}
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/30 backdrop-blur-sm rounded-full text-white font-medium">
              <span>✅</span> {t("featureChores")}
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/30 backdrop-blur-sm rounded-full text-white font-medium">
              <span>💎</span> {t("featurePoints")}
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/30 backdrop-blur-sm rounded-full text-white font-medium">
              <span>🎁</span> {t("featureRewards")}
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-white text-purple-600 font-bold text-lg rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
            >
              {t("getStarted")} 🚀
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-purple-600/80 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 backdrop-blur-sm"
            >
              {t("signIn")} →
            </Link>
          </div>
        </div>

        {/* How it works section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10 drop-shadow">
            {t("howItWorks")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">{t("step1Title")}</h3>
              <p className="text-gray-600 text-sm">{t("step1Desc")}</p>
            </div>
            {/* Step 2 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-5xl mb-4">⭐</div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">{t("step2Title")}</h3>
              <p className="text-gray-600 text-sm">{t("step2Desc")}</p>
            </div>
            {/* Step 3 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">{t("step3Title")}</h3>
              <p className="text-gray-600 text-sm">{t("step3Desc")}</p>
            </div>
          </div>
        </div>

        {/* Footer tagline */}
        <div className="mt-16 mb-8 text-center">
          <p className="text-white/80 text-sm">
            {t("footerTagline")}
          </p>
        </div>
      </div>
    </div>
  );
}
