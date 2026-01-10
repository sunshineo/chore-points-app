"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function HomeLanding() {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");

  return (
    <div className="min-h-screen bg-[#FFFEF9]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#FFFEF9]/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💎</span>
            <span className="text-xl font-semibold text-gray-800">{tNav("appName")}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              {t("signIn")}
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-[#f66951] hover:bg-[#e55a43] text-white font-medium rounded-full transition-colors"
            >
              {t("getStarted")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16 sm:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left content */}
            <div className="order-2 lg:order-1">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-gray-900 leading-tight mb-6">
                {t("heroTitle")}
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-8">
                {t("heroSubtitle")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/signup"
                  className="inline-flex justify-center px-8 py-4 bg-[#f66951] hover:bg-[#e55a43] text-white font-medium rounded-full transition-colors text-lg"
                >
                  {t("getStarted")}
                </Link>
                <Link
                  href="/login"
                  className="inline-flex justify-center px-8 py-4 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-full transition-colors text-lg"
                >
                  {t("signIn")}
                </Link>
              </div>
            </div>

            {/* Right - Hero visual */}
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative">
                <div className="w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-[#dcf1f3] rounded-3xl flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-7xl sm:text-8xl mb-4">💎</div>
                    <div className="text-2xl sm:text-3xl font-light text-gray-700">
                      {tNav("appName")}
                    </div>
                  </div>
                </div>
                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 text-4xl animate-bounce" style={{ animationDuration: "3s" }}>⭐</div>
                <div className="absolute -bottom-4 -left-4 text-4xl animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}>🎁</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-4">
            {t("howItWorks")}
          </h2>
          <p className="text-lg text-gray-600 text-center mb-16 max-w-2xl mx-auto">
            {t("howItWorksSubtitle")}
          </p>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-[#dcf1f3] rounded-2xl flex items-center justify-center">
                <span className="text-4xl">📋</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{t("step1Title")}</h3>
              <p className="text-gray-600 leading-relaxed">{t("step1Desc")}</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-[#fff4e6] rounded-2xl flex items-center justify-center">
                <span className="text-4xl">⭐</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{t("step2Title")}</h3>
              <p className="text-gray-600 leading-relaxed">{t("step2Desc")}</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-[#fce4ec] rounded-2xl flex items-center justify-center">
                <span className="text-4xl">🎉</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{t("step3Title")}</h3>
              <p className="text-gray-600 leading-relaxed">{t("step3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-24 px-6 bg-[#FFFEF9]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Visual */}
            <div className="flex justify-center">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#dcf1f3] rounded-2xl p-6 flex flex-col items-center justify-center h-40">
                  <span className="text-4xl mb-2">✅</span>
                  <span className="text-gray-700 font-medium">{t("featureChores")}</span>
                </div>
                <div className="bg-[#fff4e6] rounded-2xl p-6 flex flex-col items-center justify-center h-40">
                  <span className="text-4xl mb-2">💎</span>
                  <span className="text-gray-700 font-medium">{t("featurePoints")}</span>
                </div>
                <div className="bg-[#fce4ec] rounded-2xl p-6 flex flex-col items-center justify-center h-40">
                  <span className="text-4xl mb-2">🎁</span>
                  <span className="text-gray-700 font-medium">{t("featureRewards")}</span>
                </div>
                <div className="bg-[#e8f5e9] rounded-2xl p-6 flex flex-col items-center justify-center h-40">
                  <span className="text-4xl mb-2">👨‍👩‍👧‍👦</span>
                  <span className="text-gray-700 font-medium">{t("featureFamily")}</span>
                </div>
              </div>
            </div>

            {/* Right - Content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-light text-gray-900 leading-tight mb-6">
                {t("benefitsTitle")}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                {t("benefitsDesc")}
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-[#f66951] mt-1">✓</span>
                  <span className="text-gray-600">{t("benefit1")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#f66951] mt-1">✓</span>
                  <span className="text-gray-600">{t("benefit2")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#f66951] mt-1">✓</span>
                  <span className="text-gray-600">{t("benefit3")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-6 bg-[#dcf1f3]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-6">
            {t("ctaTitle")}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            {t("ctaSubtitle")}
          </p>
          <Link
            href="/signup"
            className="inline-flex px-10 py-4 bg-[#f66951] hover:bg-[#e55a43] text-white font-medium rounded-full transition-colors text-lg"
          >
            {t("getStarted")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-[#FFFEF9] border-t border-gray-100">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl">💎</span>
            <span className="text-lg font-semibold text-gray-800">{tNav("appName")}</span>
          </div>
          <p className="text-gray-500 text-sm">
            {t("footerTagline")}
          </p>
        </div>
      </footer>
    </div>
  );
}
