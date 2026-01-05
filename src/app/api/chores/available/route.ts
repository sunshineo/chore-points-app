import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// GET /api/chores/available - List active chores for kids to see
export async function GET() {
  try {
    const session = await requireFamily();

    const chores = await prisma.chore.findMany({
      where: {
        familyId: session.user.familyId!,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        icon: true,
        defaultPoints: true,
      },
      orderBy: { title: "asc" },
    });

    return NextResponse.json({ chores });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Forbidden") ? 403 : 401 }
    );
  }
}
