import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/permissions";

// POST /api/family/join - Join a family using invite code
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const { inviteCode } = await req.json();

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Invite code is required" },
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

    // Find family by invite code
    const family = await prisma.family.findUnique({
      where: { inviteCode },
    });

    if (!family) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 404 }
      );
    }

    // Update user with family (keep existing role)
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        familyId: family.id,
        // Keep user's existing role - they chose it during signup
      },
    });

    return NextResponse.json({
      success: true,
      family,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        familyId: updatedUser.familyId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
