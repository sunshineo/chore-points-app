import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import GroceryPageContent from "@/components/meals/GroceryPageContent";

export default async function GroceryPage() {
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
        <GroceryPageContent />
      </div>
    </div>
  );
}
