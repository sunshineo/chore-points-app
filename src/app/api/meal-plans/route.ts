import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";
import { getWeekStart } from "@/lib/week-utils";

// GET /api/meal-plans - Get current/next week's plan with dishes
export async function GET(req: Request) {
  try {
    const session = await requireFamily();
    const { searchParams } = new URL(req.url);

    // Allow specifying week via query param, default to next week
    const weekParam = searchParams.get("week");
    let weekStart: Date;

    if (weekParam) {
      // Parse as local noon to avoid timezone issues
      weekStart = getWeekStart(new Date(`${weekParam}T12:00:00`));
    } else {
      // Default to next week (Saturday after this Saturday)
      const today = new Date();
      const thisWeekStart = getWeekStart(today);
      weekStart = new Date(thisWeekStart);
      weekStart.setDate(weekStart.getDate() + 7);
    }

    const plan = await prisma.weeklyPlan.findUnique({
      where: {
        familyId_weekStart: {
          familyId: session.user.familyId!,
          weekStart,
        },
      },
      include: {
        plannedMeals: {
          include: {
            dish: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      plan,
      weekStart: weekStart.toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    if (errorMessage === "Unauthorized") {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    if (errorMessage.includes("Forbidden")) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/meal-plans - Create or update week's plan
export async function POST(req: Request) {
  try {
    const session = await requireFamily();

    // Only parents can create/edit plans
    if (session.user.role !== "PARENT") {
      return NextResponse.json(
        { error: "Only parents can create meal plans" },
        { status: 403 }
      );
    }

    const { dishIds, weekStart: weekStartParam } = await req.json();

    if (!Array.isArray(dishIds)) {
      return NextResponse.json(
        { error: "dishIds must be an array" },
        { status: 400 }
      );
    }

    // Determine week start
    let weekStart: Date;
    if (weekStartParam) {
      weekStart = getWeekStart(new Date(`${weekStartParam}T12:00:00`));
    } else {
      // Default to next week
      const today = new Date();
      const thisWeekStart = getWeekStart(today);
      weekStart = new Date(thisWeekStart);
      weekStart.setDate(weekStart.getDate() + 7);
    }

    // Verify all dishes belong to the family
    if (dishIds.length > 0) {
      const dishes = await prisma.dish.findMany({
        where: {
          id: { in: dishIds },
          familyId: session.user.familyId!,
        },
      });

      if (dishes.length !== dishIds.length) {
        return NextResponse.json(
          { error: "Some dishes not found or don't belong to your family" },
          { status: 400 }
        );
      }
    }

    // Upsert the plan
    const plan = await prisma.weeklyPlan.upsert({
      where: {
        familyId_weekStart: {
          familyId: session.user.familyId!,
          weekStart,
        },
      },
      update: {
        // Delete existing planned meals and create new ones
        plannedMeals: {
          deleteMany: {},
          create: dishIds.map((dishId: string) => ({ dishId })),
        },
      },
      create: {
        familyId: session.user.familyId!,
        weekStart,
        createdById: session.user.id,
        plannedMeals: {
          create: dishIds.map((dishId: string) => ({ dishId })),
        },
      },
      include: {
        plannedMeals: {
          include: {
            dish: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ plan }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    if (errorMessage === "Unauthorized") {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    if (errorMessage.includes("Forbidden")) {
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
