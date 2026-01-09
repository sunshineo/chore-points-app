import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/permissions";

// GET /api/photos - Get point entries with photos
// Parents: all family photos, Kids: only their own photos
// Optional kidId query param for parents to filter by specific kid
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.familyId) {
      return NextResponse.json({ error: "No family" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const kidIdParam = searchParams.get("kidId");

    const isParent = session.user.role === "PARENT";

    // Build the where clause
    const whereClause: {
      familyId: string;
      photoUrl: { not: null };
      kidId?: string;
    } = {
      familyId: session.user.familyId,
      photoUrl: { not: null },
    };

    // Kids can only see their own photos
    if (!isParent) {
      whereClause.kidId = session.user.id;
    } else if (kidIdParam) {
      // Parents can filter by kidId
      whereClause.kidId = kidIdParam;
    }

    const photos = await prisma.pointEntry.findMany({
      where: whereClause,
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
