import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireParentInFamily } from "@/lib/permissions";

// GET /api/photos - Get all point entries with photos
export async function GET() {
  try {
    const session = await requireParentInFamily();

    const photos = await prisma.pointEntry.findMany({
      where: {
        familyId: session.user.familyId!,
        photoUrl: { not: null },
      },
      select: {
        id: true,
        photoUrl: true,
        points: true,
        note: true,
        date: true,
        chore: {
          select: { title: true },
        },
        kid: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ photos });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes("Forbidden") ? 403 : 500 }
    );
  }
}
