import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";
import { getWeekStart } from "@/lib/week-utils";

// GET /api/votes - Get current week's votes
export async function GET() {
  try {
    const session = await requireFamily();
    const weekStart = getWeekStart(new Date());

    const votes = await prisma.weeklyVote.findMany({
      where: {
        familyId: session.user.familyId!,
        weekStart,
      },
      include: {
        dish: {
          select: { id: true, name: true, photoUrl: true, totalVotes: true },
        },
        voter: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ votes, weekStart });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/votes - Cast a vote
export async function POST(req: Request) {
  try {
    const session = await requireFamily();
    const { dishId, suggestedDishName } = await req.json();

    if (!dishId && !suggestedDishName) {
      return NextResponse.json(
        { error: "Either dishId or suggestedDishName is required" },
        { status: 400 }
      );
    }

    if (dishId && suggestedDishName) {
      return NextResponse.json(
        { error: "Provide either dishId or suggestedDishName, not both" },
        { status: 400 }
      );
    }

    const weekStart = getWeekStart(new Date());

    // Check for existing vote
    const existingVote = await prisma.weeklyVote.findFirst({
      where: {
        familyId: session.user.familyId!,
        voterId: session.user.id,
        weekStart,
        ...(dishId ? { dishId } : { suggestedDishName }),
      },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: "You have already voted for this dish this week" },
        { status: 400 }
      );
    }

    // If voting for existing dish, verify it exists
    if (dishId) {
      const dish = await prisma.dish.findFirst({
        where: {
          id: dishId,
          familyId: session.user.familyId!,
        },
      });

      if (!dish) {
        return NextResponse.json(
          { error: "Dish not found" },
          { status: 404 }
        );
      }

      // Increment totalVotes on dish
      await prisma.dish.update({
        where: { id: dishId },
        data: { totalVotes: { increment: 1 } },
      });
    }

    const vote = await prisma.weeklyVote.create({
      data: {
        familyId: session.user.familyId!,
        voterId: session.user.id,
        weekStart,
        ...(dishId ? { dishId } : { suggestedDishName: suggestedDishName.trim() }),
      },
      include: {
        dish: {
          select: { id: true, name: true, photoUrl: true, totalVotes: true },
        },
        voter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ vote }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
