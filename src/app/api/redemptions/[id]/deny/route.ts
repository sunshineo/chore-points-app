import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireParentInFamily } from "@/lib/permissions";

// PUT /api/redemptions/[id]/deny - Parent denies a redemption
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireParentInFamily();

    const { id } = await params;

    // Get the redemption
    const redemption = await prisma.redemption.findUnique({
      where: { id },
    });

    if (!redemption) {
      return NextResponse.json(
        { error: "Redemption not found" },
        { status: 404 }
      );
    }

    if (redemption.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Redemption belongs to another family" },
        { status: 403 }
      );
    }

    if (redemption.status !== "PENDING") {
      return NextResponse.json(
        { error: "Redemption has already been resolved" },
        { status: 400 }
      );
    }

    // Update redemption status to denied
    const updatedRedemption = await prisma.redemption.update({
      where: { id },
      data: {
        status: "DENIED",
        resolvedAt: new Date(),
        resolvedById: session.user.id,
      },
      include: {
        kid: {
          select: { name: true, email: true },
        },
        reward: {
          select: { title: true, costPoints: true, imageUrl: true },
        },
        resolvedBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ redemption: updatedRedemption });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
