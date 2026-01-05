import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireParentInFamily } from "@/lib/permissions";

// PUT /api/rewards/[id] - Update a reward (parent only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireParentInFamily();

    const { id } = await params;
    const { title, costPoints, imageUrl } = await req.json();

    // Verify reward belongs to user's family
    const existingReward = await prisma.reward.findUnique({
      where: { id },
    });

    if (!existingReward) {
      return NextResponse.json(
        { error: "Reward not found" },
        { status: 404 }
      );
    }

    if (existingReward.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Reward belongs to another family" },
        { status: 403 }
      );
    }

    const updateData: any = {
      updatedById: session.user.id,
    };

    if (title !== undefined) {
      if (typeof title !== "string" || !title) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.title = title;
    }

    if (costPoints !== undefined) {
      if (typeof costPoints !== "number" || costPoints <= 0) {
        return NextResponse.json(
          { error: "Cost points must be a positive number" },
          { status: 400 }
        );
      }
      updateData.costPoints = costPoints;
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl || null;
    }

    const reward = await prisma.reward.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        updatedBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ reward });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE /api/rewards/[id] - Delete a reward (parent only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireParentInFamily();

    const { id } = await params;

    // Verify reward belongs to user's family
    const existingReward = await prisma.reward.findUnique({
      where: { id },
      include: {
        redemptions: true,
      },
    });

    if (!existingReward) {
      return NextResponse.json(
        { error: "Reward not found" },
        { status: 404 }
      );
    }

    if (existingReward.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Reward belongs to another family" },
        { status: 403 }
      );
    }

    // Check if reward has any redemptions
    if (existingReward.redemptions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete reward with existing redemptions" },
        { status: 400 }
      );
    }

    await prisma.reward.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
