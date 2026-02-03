import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import MealsPageHeader from "@/components/meals/MealsPageHeader";
import MealsCalendarView from "@/components/meals/MealsCalendarView";

export default async function MealsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.familyId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MealsPageHeader />
        <div className="mt-8">
          <MealsCalendarView />
        </div>
      </div>
    </div>
  );
}
