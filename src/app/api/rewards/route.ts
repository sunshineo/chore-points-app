import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily, requireParentInFamily } from "@/lib/permissions";

// GET /api/rewards - Get all rewards for the family (accessible by both parents and kids)
export async function GET() {
  try {
    const session = await requireFamily();

    const rewards = await prisma.reward.findMany({
      where: {
        familyId: session.user.familyId!,
      },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        updatedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ rewards });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}

// POST /api/rewards - Create a new reward (parent only)
export async function POST(req: Request) {
  try {
    const session = await requireParentInFamily();

    const { title, costPoints, imageUrl } = await req.json();

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      );
    }

    if (typeof costPoints !== "number" || costPoints <= 0) {
      return NextResponse.json(
        { error: "Cost points must be a positive number" },
        { status: 400 }
      );
    }

    const reward = await prisma.reward.create({
      data: {
        title,
        costPoints,
        imageUrl: imageUrl || null,
        familyId: session.user.familyId!,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        updatedBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
