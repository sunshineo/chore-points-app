import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";
import { generateSightWordImage } from "@/lib/gemini-image";

const UPCOMING_IMAGE_PREFETCH = 2;

async function prefetchUpcomingImages(
  familyId: string,
  currentSortOrder: number,
  updatedById: string
) {
  const upcoming = await prisma.sightWord.findMany({
    where: {
      familyId,
      isActive: true,
      imageUrl: null,
      sortOrder: { gt: currentSortOrder },
    },
    orderBy: { sortOrder: "asc" },
    take: UPCOMING_IMAGE_PREFETCH,
  });

  for (const sw of upcoming) {
    try {
      const url = await generateSightWordImage(sw.word, familyId);
      await prisma.sightWord.update({
        where: { id: sw.id },
        data: { imageUrl: url, updatedById },
      });
    } catch (err) {
      console.error(
        `[sight-words] prefetch image gen failed for "${sw.word}":`,
        err
      );
    }
  }
}

// POST /api/sight-words/quiz - Submit a quiz answer and award point if correct
export async function POST(req: Request) {
  try {
    const session = await requireFamily();

    const { sightWordId, answer, kidId, timezone = "America/Los_Angeles" } = await req.json();

    // Determine the target kid - either the logged-in kid, or the kid specified by parent
    let targetKidId = session.user.id;

    if (session.user.role === "PARENT" && kidId) {
      // Parent submitting on behalf of a kid (view-as mode)
      const kid = await prisma.user.findUnique({
        where: { id: kidId },
      });
      if (!kid || kid.familyId !== session.user.familyId || kid.role !== "KID") {
        return NextResponse.json(
          { error: "Invalid kid" },
          { status: 400 }
        );
      }
      targetKidId = kidId;
    } else if (session.user.role !== "KID") {
      return NextResponse.json(
        { error: "kidId is required for parents" },
        { status: 400 }
      );
    }

    if (!sightWordId || typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json(
        { error: "sightWordId and a non-empty answer are required" },
        { status: 400 }
      );
    }

    // Get the sight word
    const sightWord = await prisma.sightWord.findUnique({
      where: { id: sightWordId },
    });

    if (!sightWord || sightWord.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Sight word not found" },
        { status: 404 }
      );
    }

    // Check if answer is correct (case-insensitive)
    const isCorrect = answer.trim().toLowerCase() === sightWord.word.toLowerCase();

    if (!isCorrect) {
      return NextResponse.json({
        correct: false,
        pointAwarded: false,
        message: "incorrect",
      });
    }

    // Helper to get date string in user's timezone
    const getLocalDateString = (date: Date, tz: string): string => {
      return date.toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD" format
    };

    // Get today's date in user's timezone
    const todayLocal = getLocalDateString(new Date(), timezone);

    const existingProgress = await prisma.sightWordProgress.findUnique({
      where: {
        kidId_sightWordId: {
          kidId: targetKidId,
          sightWordId,
        },
      },
    });

    // Check if already passed today (in user's timezone)
    let alreadyPassedToday = false;
    if (existingProgress?.quizPassedAt) {
      const passedDateLocal = getLocalDateString(
        new Date(existingProgress.quizPassedAt),
        timezone
      );
      alreadyPassedToday = passedDateLocal === todayLocal;
    }

    if (alreadyPassedToday) {
      return NextResponse.json({
        correct: true,
        pointAwarded: false,
        message: "alreadyCompleted",
      });
    }

    // Ensure the progress row exists so the compare-and-swap below always
    // targets a real row (Prisma upsert is an atomic INSERT ... ON CONFLICT on
    // Postgres, so concurrent callers don't collide).
    await prisma.sightWordProgress.upsert({
      where: {
        kidId_sightWordId: { kidId: targetKidId, sightWordId },
      },
      create: {
        kidId: targetKidId,
        sightWordId,
        viewedAt: new Date(),
        quizPassedAt: null,
        pointAwarded: false,
      },
      update: {},
    });

    // Optimistic-concurrency award: only the request that flips quizPassedAt
    // away from the value we just observed awards the point. A duplicate
    // correct submission (double-click / retry) reads the same prior value but
    // matches zero rows on its update because the winner already moved it —
    // Postgres serializes the two updateMany calls via the row lock — so the
    // point is never awarded twice for the same word in the same day.
    const prevPassedAt = existingProgress?.quizPassedAt ?? null;

    const awarded = await prisma.$transaction(async (tx) => {
      const { count } = await tx.sightWordProgress.updateMany({
        where: {
          kidId: targetKidId,
          sightWordId,
          quizPassedAt: prevPassedAt,
        },
        data: {
          quizPassedAt: new Date(),
          pointAwarded: true,
        },
      });

      if (count === 0) return false;

      await tx.pointEntry.create({
        data: {
          familyId: session.user.familyId!,
          kidId: targetKidId,
          points: 1,
          note: `Sight word: ${sightWord.word}`,
          createdById: session.user.id,
          updatedById: session.user.id,
        },
      });

      return true;
    });

    if (!awarded) {
      return NextResponse.json({
        correct: true,
        pointAwarded: false,
        message: "alreadyCompleted",
      });
    }

    after(() =>
      prefetchUpcomingImages(
        session.user.familyId!,
        sightWord.sortOrder,
        session.user.id
      )
    );

    return NextResponse.json({
      correct: true,
      pointAwarded: true,
      message: "success",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
