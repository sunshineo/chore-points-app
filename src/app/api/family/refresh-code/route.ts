import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireParentInFamily } from "@/lib/permissions";

// Generate a 6-character alphanumeric invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: 0, O, 1, I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/family/refresh-code - Generate a new invite code
export async function POST() {
  try {
    const session = await requireParentInFamily();

    // Generate unique invite code (retry if collision)
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.family.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Update family with new invite code
    const family = await prisma.family.update({
      where: { id: session.user.familyId! },
      data: { inviteCode },
    });

    return NextResponse.json({ inviteCode: family.inviteCode });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
