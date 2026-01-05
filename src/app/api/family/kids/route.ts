import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// GET /api/family/kids - Get all kids in the family
export async function GET() {
  try {
    const session = await requireFamily();

    const kids = await prisma.user.findMany({
      where: {
        familyId: session.user.familyId!,
        role: "KID",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ kids });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes("Forbidden") ? 403 : 401 }
    );
  }
}
