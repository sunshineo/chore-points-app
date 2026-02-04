import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// GET /api/math/stats - Get aggregated stats for a kid
export async function GET(req: Request) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get("kidId");
    const days = parseInt(searchParams.get("days") || "30");

    if (!kidId) {
      return NextResponse.json({ error: "kidId required" }, { status: 400 });
    }

    // Verify kid belongs to family
    const kid = await prisma.user.findUnique({
      where: { id: kidId },
    });

    if (!kid || kid.familyId !== session.user.familyId) {
      return NextResponse.json({ error: "Kid not found" }, { status: 404 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all attempts in period
    const attempts = await prisma.mathAttempt.findMany({
      where: {
        kidId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate stats
    const total = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Stats by type
    const byType: Record<string, { total: number; correct: number; accuracy: number }> = {};
    for (const attempt of attempts) {
      if (!byType[attempt.questionType]) {
        byType[attempt.questionType] = { total: 0, correct: 0, accuracy: 0 };
      }
      byType[attempt.questionType].total++;
      if (attempt.isCorrect) {
        byType[attempt.questionType].correct++;
      }
    }
    for (const type of Object.keys(byType)) {
      byType[type].accuracy = Math.round(
        (byType[type].correct / byType[type].total) * 100
      );
    }

    // Calculate streak (consecutive correct first attempts per day)
    const dailyProgress = await prisma.mathProgress.findMany({
      where: {
        kidId,
        pointAwarded: true,
      },
      orderBy: { date: "desc" },
      take: 30,
    });

    let streak = 0;
    const today = new Date().toISOString().split("T")[0];
    for (let i = 0; i < dailyProgress.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expected = expectedDate.toISOString().split("T")[0];
      if (dailyProgress[i].date === expected || (i === 0 && dailyProgress[i].date === today)) {
        streak++;
      } else {
        break;
      }
    }

    // Common mistakes (wrong answers)
    const wrongAttempts = attempts.filter((a) => !a.isCorrect);
    const mistakePatterns: Record<string, number> = {};
    for (const attempt of wrongAttempts) {
      const diff = attempt.givenAnswer - attempt.correctAnswer;
      const pattern = diff > 0 ? `+${diff}` : `${diff}`;
      mistakePatterns[pattern] = (mistakePatterns[pattern] || 0) + 1;
    }

    // Sort mistakes by frequency
    const topMistakes = Object.entries(mistakePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));

    return NextResponse.json({
      total,
      correct,
      accuracy,
      byType,
      streak,
      topMistakes,
      period: { days, since: since.toISOString() },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Forbidden") ? 403 : 500 }
    );
  }
}
