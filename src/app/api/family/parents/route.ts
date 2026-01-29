import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// GET /api/family/parents - Get all parents in the family
export async function GET() {
  try {
    const session = await requireFamily();

    const parents = await prisma.user.findMany({
      where: {
        familyId: session.user.familyId!,
        role: "PARENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ parents });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes("Forbidden") ? 403 : 401 }
    );
  }
}
