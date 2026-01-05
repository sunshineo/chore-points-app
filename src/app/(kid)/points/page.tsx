import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import KidPointsView from "@/components/points/KidPointsView";
import Link from "next/link";

export default async function KidPointsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.familyId) {
    redirect("/dashboard");
  }

  if (session.user.role !== "KID") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Points</h1>
            <p className="mt-2 text-gray-600">
              Track your points and see your chore history
            </p>
          </div>
          <Link
            href="/redeem"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            Redeem Rewards
          </Link>
        </div>

        <div className="mt-8">
          <KidPointsView kidId={session.user.id} />
        </div>
      </div>
    </div>
  );
}
