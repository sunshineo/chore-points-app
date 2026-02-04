import { NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireParentInFamily();

    const family = await prisma.family.findUnique({
      where: { id: session.user.familyId! },
      select: {
        hueAccessToken: true,
        hueUsername: true,
      },
    });

    const connected = !!(family?.hueAccessToken && family?.hueUsername);

    return NextResponse.json({ connected });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: "Failed to get Hue status" },
      { status: 500 }
    );
  }
}
