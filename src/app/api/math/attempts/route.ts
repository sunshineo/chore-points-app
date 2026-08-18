import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// GET /api/math/attempts - Get attempt history for analytics
export async function GET(req: Request) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get("kidId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");
    const incorrectOnly = searchParams.get("incorrectOnly") === "true";
    // Clamp to sane values so NaN/negative params can't reach Prisma take/skip.
    const parsedLimit = parseInt(searchParams.get("limit") || "100");
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 500)
      : 100;
    const parsedOffset = parseInt(searchParams.get("offset") || "0");
    const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

    // Build where clause
    const where: Record<string, unknown> = {
      kid: { familyId: session.user.familyId },
    };

    if (kidId) {
      where.kidId = kidId;
    }

    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) range.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) range.lte = toDate;
      }
      // Only apply the filter if at least one bound parsed to a valid date,
      // otherwise an invalid `from`/`to` would make Prisma throw.
      if (range.gte || range.lte) {
        where.createdAt = range;
      }
    }

    if (type) {
      where.questionType = type;
    }

    if (incorrectOnly) {
      where.isCorrect = false;
    }

    const [attempts, total] = await Promise.all([
      prisma.mathAttempt.findMany({
        where,
        include: {
          kid: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.mathAttempt.count({ where }),
    ]);

    return NextResponse.json({
      attempts,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Forbidden") ? 403 : 500 }
    );
  }
}
