import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import CalendarPageHeader from "@/components/calendar/CalendarPageHeader";
import CalendarView from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "PARENT") {
    redirect("/dashboard");
  }

  if (!session.user.familyId) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <CalendarPageHeader />
      <CalendarView />
    </div>
  );
}
