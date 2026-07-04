import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PUT /api/math/questions/[id] - Update a question
export async function PUT(req: Request, context: RouteContext) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    const { id } = await context.params;
    const data = await req.json();

    // Verify question belongs to family
    const existing = await prisma.customMathQuestion.findUnique({
      where: { id },
    });

    if (!existing || existing.familyId !== session.user.familyId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Validate mutable fields so raw body values can't reassign the question to
    // another family's kid or crash Prisma's Int coercion on a bad answer.
    if (data.answer !== undefined && (typeof data.answer !== "number" || !Number.isInteger(data.answer))) {
      return NextResponse.json({ error: "answer must be an integer" }, { status: 400 });
    }
    if (data.question !== undefined && (typeof data.question !== "string" || !data.question.trim())) {
      return NextResponse.json({ error: "question must be a non-empty string" }, { status: 400 });
    }
    if (data.kidId) {
      const kid = await prisma.user.findFirst({
        where: { id: data.kidId, familyId: session.user.familyId!, role: "KID" },
      });
      if (!kid) {
        return NextResponse.json({ error: "Kid is not in your family" }, { status: 400 });
      }
    }

    const question = await prisma.customMathQuestion.update({
      where: { id },
      data: {
        question: data.question,
        answer: data.answer,
        questionType: data.questionType,
        tags: data.tags,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        scheduledDate: data.scheduledDate ?? undefined,
        kidId: data.kidId ?? undefined,
      },
    });

    return NextResponse.json(question);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/math/questions/[id] - Delete a question
export async function DELETE(req: Request, context: RouteContext) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    const { id } = await context.params;

    // Verify question belongs to family
    const existing = await prisma.customMathQuestion.findUnique({
      where: { id },
    });

    if (!existing || existing.familyId !== session.user.familyId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    await prisma.customMathQuestion.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
