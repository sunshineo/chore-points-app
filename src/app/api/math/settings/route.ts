import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// GET /api/math/settings - Get family's math settings
export async function GET() {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    let settings = await prisma.mathSettings.findUnique({
      where: { familyId: session.user.familyId! },
    });

    // Return defaults if no settings exist
    if (!settings) {
      settings = {
        id: "",
        familyId: session.user.familyId!,
        dailyQuestionCount: 2,
        additionEnabled: true,
        subtractionEnabled: true,
        multiplicationEnabled: false,
        divisionEnabled: false,
        additionMinA: 1,
        additionMaxA: 9,
        additionMinB: 10,
        additionMaxB: 99,
        allowCarrying: true,
        subtractionMinA: 10,
        subtractionMaxA: 99,
        subtractionMinB: 1,
        subtractionMaxB: 9,
        allowBorrowing: true,
        multiplicationMinA: 1,
        multiplicationMaxA: 10,
        multiplicationMinB: 1,
        multiplicationMaxB: 10,
        divisionMinDividend: 1,
        divisionMaxDividend: 100,
        divisionMinDivisor: 1,
        divisionMaxDivisor: 10,
        adaptiveDifficulty: false,
        focusAreas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Forbidden") ? 403 : 401 }
    );
  }
}

// Validate a range field (min/max pair)
function validateRange(
  data: Record<string, unknown>,
  minKey: string,
  maxKey: string,
  minAllowed: number = 0,
  maxAllowed: number = 9999
): string | null {
  const min = data[minKey];
  const max = data[maxKey];

  if (min !== undefined) {
    const minNum = Number(min);
    if (isNaN(minNum) || minNum < minAllowed || minNum > maxAllowed) {
      return `${minKey} must be between ${minAllowed} and ${maxAllowed}`;
    }
    data[minKey] = minNum;
  }

  if (max !== undefined) {
    const maxNum = Number(max);
    if (isNaN(maxNum) || maxNum < minAllowed || maxNum > maxAllowed) {
      return `${maxKey} must be between ${minAllowed} and ${maxAllowed}`;
    }
    data[maxKey] = maxNum;
  }

  // Check min <= max if both provided
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
    return `${minKey} cannot be greater than ${maxKey}`;
  }

  return null;
}

// PUT /api/math/settings - Update family's math settings
export async function PUT(req: Request) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    const data = await req.json();

    // Validate dailyQuestionCount
    if (data.dailyQuestionCount !== undefined) {
      const count = Number(data.dailyQuestionCount);
      if (isNaN(count) || count < 1 || count > 20) {
        return NextResponse.json(
          { error: "dailyQuestionCount must be between 1 and 20" },
          { status: 400 }
        );
      }
      data.dailyQuestionCount = count;
    }

    // Validate addition ranges
    let error = validateRange(data, "additionMinA", "additionMaxA", 0, 9999);
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateRange(data, "additionMinB", "additionMaxB", 0, 9999);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Validate subtraction ranges
    error = validateRange(data, "subtractionMinA", "subtractionMaxA", 0, 9999);
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateRange(data, "subtractionMinB", "subtractionMaxB", 0, 9999);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Validate multiplication ranges
    error = validateRange(data, "multiplicationMinA", "multiplicationMaxA", 1, 999);
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateRange(data, "multiplicationMinB", "multiplicationMaxB", 1, 999);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Validate division ranges (divisor must be >= 1 to avoid division by zero)
    error = validateRange(data, "divisionMinDividend", "divisionMaxDividend", 1, 9999);
    if (error) return NextResponse.json({ error }, { status: 400 });
    error = validateRange(data, "divisionMinDivisor", "divisionMaxDivisor", 1, 999);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Whitelist allowed fields to prevent unexpected data
    const allowedFields = [
      "dailyQuestionCount",
      "additionEnabled",
      "subtractionEnabled",
      "multiplicationEnabled",
      "divisionEnabled",
      "additionMinA",
      "additionMaxA",
      "additionMinB",
      "additionMaxB",
      "allowCarrying",
      "subtractionMinA",
      "subtractionMaxA",
      "subtractionMinB",
      "subtractionMaxB",
      "allowBorrowing",
      "multiplicationMinA",
      "multiplicationMaxA",
      "multiplicationMinB",
      "multiplicationMaxB",
      "divisionMinDividend",
      "divisionMaxDividend",
      "divisionMinDivisor",
      "divisionMaxDivisor",
      "adaptiveDifficulty",
      "focusAreas",
    ];

    const sanitizedData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        sanitizedData[key] = data[key];
      }
    }

    const settings = await prisma.mathSettings.upsert({
      where: { familyId: session.user.familyId! },
      create: {
        familyId: session.user.familyId!,
        ...sanitizedData,
      },
      update: sanitizedData,
    });

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Forbidden") ? 403 : 500 }
    );
  }
}
