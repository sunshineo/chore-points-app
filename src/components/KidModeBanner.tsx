"use client";

import { useKidMode } from "@/components/providers/KidModeProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function KidModeBanner() {
  const { isKidMode, viewingAsKid, exitKidMode } = useKidMode();
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("kidMode");

  // Only show for parents in Kid Mode
  if (!isKidMode || session?.user?.role !== "PARENT") {
    return null;
  }

  const handleExitKidMode = () => {
    exitKidMode();
    router.push("/dashboard");
  };

  return (
    <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <span className="text-lg">👁️</span>
        <span className="font-medium text-sm sm:text-base">
          {t("viewingAs", { name: viewingAsKid?.name || viewingAsKid?.email || "" })}
        </span>
        <button
          onClick={handleExitKidMode}
          className="ml-2 sm:ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs sm:text-sm font-medium transition-colors"
        >
          {t("exitKidMode")}
        </button>
      </div>
    </div>
  );
}
