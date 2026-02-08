import { NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function DELETE() {
  try {
    const session = await requireParentInFamily();

    await prisma.family.update({
      where: { id: session.user.familyId! },
      data: {
        hueAccessToken: null,
        hueRefreshToken: null,
        hueTokenExpiry: null,
        hueUsername: null,
      },
    });

    return NextResponse.json({ success: true });
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
      { error: "Failed to disconnect Hue" },
      { status: 500 }
    );
  }
}
