import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import KidRewardsView from "@/components/rewards/KidRewardsView";

export default async function RedeemPage() {
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
        <h1 className="text-3xl font-bold text-gray-900">Redeem Rewards</h1>
        <p className="mt-2 text-gray-600">
          Use your points to redeem awesome rewards!
        </p>

        <div className="mt-8">
          <KidRewardsView kidId={session.user.id} />
        </div>
      </div>
    </div>
  );
}
