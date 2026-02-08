import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import LightsPageContent from "@/components/lights/LightsPageContent";

export default async function LightsPage() {
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

  // Check if Hue is connected
  const family = await prisma.family.findUnique({
    where: { id: session.user.familyId },
    select: { hueAccessToken: true },
  });

  if (!family?.hueAccessToken) {
    redirect("/settings?hue_error=not_connected");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <LightsPageContent />
    </div>
  );
}
