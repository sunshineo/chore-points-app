import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireParent } from "@/lib/permissions";

// GET /api/family - Get current user's family
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session.user.familyId) {
      return NextResponse.json({ family: null });
    }

    const family = await prisma.family.findUnique({
      where: { id: session.user.familyId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ family });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST /api/family - Create a new family (parent only)
export async function POST(req: Request) {
  try {
    const session = await requireParent();
    const { name } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "Family name is required" },
        { status: 400 }
      );
    }

    // Check if user already in a family
    if (session.user.familyId) {
      return NextResponse.json(
        { error: "You are already part of a family" },
        { status: 400 }
      );
    }

    // Create family
    const family = await prisma.family.create({
      data: {
        name,
        users: {
          connect: { id: session.user.id },
        },
      },
    });

    return NextResponse.json({ family }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: error.message === "Forbidden: Parent role required" ? 403 : 500 }
    );
  }
}
