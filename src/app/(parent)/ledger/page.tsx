import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import PointsLedger from "@/components/points/PointsLedger";

export default async function LedgerPage() {
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Points Ledger</h1>
          <p className="mt-2 text-gray-600">
            Track and manage points for your kids
          </p>
        </div>

        <PointsLedger />
      </div>
    </div>
  );
}
