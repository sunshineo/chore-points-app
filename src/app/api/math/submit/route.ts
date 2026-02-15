import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";
import {
  generateQuestionsWithSettings,
  getLocalDateString,
} from "@/lib/math-utils";

// POST /api/math/submit - Submit a math answer
export async function POST(req: Request) {
  try {
    const session = await requireFamily();
    const {
      questionIndex,
      answer,
      kidId,
      timezone = "America/Los_Angeles",
      responseTimeMs,
      source = "daily",
    } = await req.json();

    if (typeof questionIndex !== "number" || questionIndex < 0) {
      return NextResponse.json(
        { error: "questionIndex must be a non-negative number" },
        { status: 400 }
      );
    }

    if (typeof answer !== "number") {
      return NextResponse.json(
        { error: "answer must be a number" },
        { status: 400 }
      );
    }

    // Determine target kid ID
    let targetKidId = session.user.id;

    if (session.user.role === "PARENT" && kidId) {
      const kid = await prisma.user.findUnique({
        where: { id: kidId },
      });
      if (!kid || kid.familyId !== session.user.familyId || kid.role !== "KID") {
        return NextResponse.json({ error: "Invalid kid" }, { status: 400 });
      }
      targetKidId = kidId;
    } else if (session.user.role !== "KID") {
      return NextResponse.json(
        { error: "kidId is required for parents" },
        { status: 400 }
      );
    }

    // Get today's date in user's timezone
    const todayStr = getLocalDateString(new Date(), timezone);

    // Check for custom scheduled questions first
    const customQuestions = await prisma.customMathQuestion.findMany({
      where: {
        familyId: session.user.familyId!,
        kidId: targetKidId,
        scheduledDate: todayStr,
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    let expectedAnswer: number;
    let questionType: string;
    let questionText: string;
    let questionsTarget: number;
    let actualSource: string;

    if (customQuestions.length > 0) {
      if (questionIndex >= customQuestions.length) {
        return NextResponse.json(
          { error: "Invalid question index" },
          { status: 400 }
        );
      }
      const cq = customQuestions[questionIndex];
      expectedAnswer = cq.answer;
      questionType = cq.questionType;
      questionText = cq.question;
      questionsTarget = customQuestions.length;
      actualSource = "custom";
    } else {
      const settings = await prisma.mathSettings.findUnique({
        where: { familyId: session.user.familyId! },
      });
      questionsTarget = settings?.dailyQuestionCount ?? 2;
      const questions = generateQuestionsWithSettings(todayStr, targetKidId, settings || {});

      if (questionIndex >= questions.length) {
        return NextResponse.json(
          { error: "Invalid question index" },
          { status: 400 }
        );
      }
      const q = questions[questionIndex];
      expectedAnswer = q.answer;
      questionType = q.type;
      questionText = q.question;
      actualSource = source;
    }

    const isCorrect = answer === expectedAnswer;

    // Log the attempt
    await prisma.mathAttempt.create({
      data: {
        kidId: targetKidId,
        questionType,
        question: questionText,
        correctAnswer: expectedAnswer,
        givenAnswer: answer,
        isCorrect,
        responseTimeMs: responseTimeMs ? Math.round(responseTimeMs) : null,
        source: actualSource,
      },
    });

    if (!isCorrect) {
      return NextResponse.json({
        correct: false,
        pointAwarded: false,
      });
    }

    // Get or create progress record
    const existingProgress = await prisma.mathProgress.findUnique({
      where: {
        kidId_date: {
          kidId: targetKidId,
          date: todayStr,
        },
      },
    });

    const currentCompleted = existingProgress?.questionsCompleted ?? 0;

    if (questionIndex < currentCompleted) {
      return NextResponse.json({
        correct: true,
        pointAwarded: false,
        message: "alreadyCompleted",
      });
    }

    if (questionIndex !== currentCompleted) {
      return NextResponse.json({
        correct: true,
        pointAwarded: false,
        message: "wrongOrder",
      });
    }

    const newCompleted = currentCompleted + 1;
    const allComplete = newCompleted >= questionsTarget;
    const isCustom = customQuestions.length > 0;

    // Point logic differs:
    // - Custom questions: 1 point per correct answer (immediate reward)
    // - Auto-generated: 1 point when ALL questions complete (original behavior)
    const shouldAwardPoint = isCustom
      ? true // always award for each correct custom answer
      : allComplete; // only award when all auto questions done

    const pointNote = isCustom ? "Math: custom question" : "Math: daily practice";

    const updatedProgress = await prisma.$transaction(async (tx) => {
      const progress = await tx.mathProgress.upsert({
        where: {
          kidId_date: {
            kidId: targetKidId,
            date: todayStr,
          },
        },
        create: {
          kidId: targetKidId,
          date: todayStr,
          questionsCompleted: 1,
          questionsTarget,
          pointAwarded: allComplete,
        },
        update: {
          questionsCompleted: newCompleted,
          questionsTarget,
          pointAwarded: allComplete ? true : undefined,
        },
      });

      if (shouldAwardPoint) {
        const points = isCustom ? 1 : 1; // 1 point either way, but timing differs
        await tx.pointEntry.create({
          data: {
            familyId: session.user.familyId!,
            kidId: targetKidId,
            points,
            note: pointNote,
            createdById: session.user.id,
            updatedById: session.user.id,
          },
        });
      }

      return progress;
    });

    return NextResponse.json({
      correct: true,
      pointAwarded: shouldAwardPoint,
      questionsCompleted: updatedProgress.questionsCompleted,
      questionsTarget,
      allComplete,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
