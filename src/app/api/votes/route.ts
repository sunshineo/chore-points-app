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

    // Normalize suggested name up front so a non-string body can't throw on
    // .trim(), and so the dedupe/unique check operates on the stored value.
    let trimmedName: string | undefined;
    if (!dishId) {
      if (typeof suggestedDishName !== "string" || !suggestedDishName.trim()) {
        return NextResponse.json(
          { error: "suggestedDishName must be a non-empty string" },
          { status: 400 }
        );
      }
      trimmedName = suggestedDishName.trim();
    }

    const weekStart = getWeekStart(new Date());

    // If voting for an existing dish, verify it belongs to this family.
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
    }

    // Create the vote and bump the dish tally atomically. The vote row is
    // created first so the @@unique constraint — not an app-level check —
    // rejects duplicates; a P2002 becomes a clean "already voted" instead of a
    // 500 with a leaked increment. Doing both in one transaction also prevents
    // the count from drifting when the create fails.
    try {
      const vote = await prisma.$transaction(async (tx) => {
        const created = await tx.weeklyVote.create({
          data: {
            familyId: session.user.familyId!,
            voterId: session.user.id,
            weekStart,
            ...(dishId ? { dishId } : { suggestedDishName: trimmedName }),
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

        if (dishId) {
          await tx.dish.update({
            where: { id: dishId },
            data: { totalVotes: { increment: 1 } },
          });
        }

        return created;
      });

      return NextResponse.json({ vote }, { status: 201 });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "You have already voted for this dish this week" },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
