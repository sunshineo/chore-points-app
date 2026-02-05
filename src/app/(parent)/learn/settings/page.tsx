import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import MathSettingsForm from "@/components/learn/MathSettingsForm";
import { getTranslations } from "next-intl/server";

export default async function MathSettingsPage() {
  const session = await getSession();
  const t = await getTranslations("learn");

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.familyId) {
    redirect("/dashboard");
  }

  if (session.user.role !== "PARENT") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{t("mathSettings")}</h1>
          <p className="text-gray-600 mt-1">{t("mathSettingsDesc")}</p>
        </div>
        <MathSettingsForm />
      </div>
    </div>
  );
}
