import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// DELETE /api/votes/[id] - Remove a vote
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFamily();
    const { id } = await params;

    const vote = await prisma.weeklyVote.findFirst({
      where: {
        id,
        familyId: session.user.familyId!,
        voterId: session.user.id,
      },
    });

    if (!vote) {
      return NextResponse.json(
        { error: "Vote not found or not yours to delete" },
        { status: 404 }
      );
    }

    // Delete the vote and decrement the tally atomically. The delete uses the
    // scoped id/family/voter filter so a concurrent double-delete removes at
    // most one row; deleteMany reports how many rows it actually removed, and we
    // only decrement when this call is the one that deleted the vote — otherwise
    // two racing deletes would each decrement for a single vote.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.weeklyVote.deleteMany({
        where: {
          id,
          familyId: session.user.familyId!,
          voterId: session.user.id,
        },
      });

      if (count > 0 && vote.dishId) {
        await tx.dish.update({
          where: { id: vote.dishId },
          data: { totalVotes: { decrement: 1 } },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
