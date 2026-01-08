import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import KidPointsView from "@/components/points/KidPointsView";
import KidPointsHeader from "@/components/points/KidPointsHeader";

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

  // Fetch total points for the header coin counter
  const pointsResult = await prisma.pointEntry.aggregate({
    where: { kidId: session.user.id },
    _sum: { points: true },
  });
  const totalPoints = pointsResult._sum.points || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <KidPointsHeader totalPoints={totalPoints} />

        <div className="mt-8">
          <KidPointsView kidId={session.user.id} />
        </div>
      </div>
    </div>
  );
}
