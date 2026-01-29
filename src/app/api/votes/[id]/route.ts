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

    // If vote was for an existing dish, decrement totalVotes
    if (vote.dishId) {
      await prisma.dish.update({
        where: { id: vote.dishId },
        data: { totalVotes: { decrement: 1 } },
      });
    }

    await prisma.weeklyVote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
