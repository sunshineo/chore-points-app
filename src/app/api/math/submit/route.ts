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

    // Fetch family's math settings
    const settings = await prisma.mathSettings.findUnique({
      where: { familyId: session.user.familyId! },
    });

    const questionsTarget = settings?.dailyQuestionCount ?? 2;

    // Generate today's questions
    const questions = generateQuestionsWithSettings(todayStr, targetKidId, settings || {});

    // Validate question index
    if (questionIndex >= questions.length) {
      return NextResponse.json(
        { error: "Invalid question index" },
        { status: 400 }
      );
    }

    const question = questions[questionIndex];
    const expectedAnswer = question.answer;
    const isCorrect = answer === expectedAnswer;

    // Log the attempt
    await prisma.mathAttempt.create({
      data: {
        kidId: targetKidId,
        questionType: question.type,
        question: question.question,
        correctAnswer: expectedAnswer,
        givenAnswer: answer,
        isCorrect,
        responseTimeMs: responseTimeMs ? Math.round(responseTimeMs) : null,
        source,
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

    // Check if this question was already completed (by checking if we're past this index)
    if (questionIndex < currentCompleted) {
      return NextResponse.json({
        correct: true,
        pointAwarded: false,
        message: "alreadyCompleted",
      });
    }

    // Only increment if this is the next expected question
    if (questionIndex !== currentCompleted) {
      return NextResponse.json({
        correct: true,
        pointAwarded: false,
        message: "wrongOrder",
      });
    }

    // Update progress
    const newCompleted = currentCompleted + 1;
    const updatedProgress = await prisma.mathProgress.upsert({
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
      },
      update: {
        questionsCompleted: newCompleted,
        questionsTarget,
      },
    });

    // Check if all questions are now complete and point not yet awarded
    const allComplete = updatedProgress.questionsCompleted >= questionsTarget;
    let pointAwarded = false;

    if (allComplete && !updatedProgress.pointAwarded) {
      // Award point
      await prisma.$transaction([
        prisma.mathProgress.update({
          where: { id: updatedProgress.id },
          data: { pointAwarded: true },
        }),
        prisma.pointEntry.create({
          data: {
            familyId: session.user.familyId!,
            kidId: targetKidId,
            points: 1,
            note: "Math: daily practice",
            createdById: session.user.id,
            updatedById: session.user.id,
          },
        }),
      ]);
      pointAwarded = true;
    }

    return NextResponse.json({
      correct: true,
      pointAwarded,
      questionsCompleted: updatedProgress.questionsCompleted,
      questionsTarget,
      allComplete,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
