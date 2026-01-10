import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";

// PUT /api/points/[id] - Update a point entry (parent only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json(
        { error: "Only parents can edit points" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { points, note, choreId, date, photoUrl } = await req.json();

    // Verify point entry belongs to user's family
    const existingEntry = await prisma.pointEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Point entry not found" },
        { status: 404 }
      );
    }

    if (existingEntry.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Point entry belongs to another family" },
        { status: 403 }
      );
    }

    // Can't edit point entries linked to redemptions
    if (existingEntry.redemptionId) {
      return NextResponse.json(
        { error: "Cannot edit point entries linked to redemptions" },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedById: session.user.id,
    };

    if (points !== undefined) {
      if (typeof points !== 'number') {
        return NextResponse.json(
          { error: "points must be a number" },
          { status: 400 }
        );
      }
      updateData.points = points;
    }

    if (note !== undefined) updateData.note = note || null;
    if (choreId !== undefined) updateData.choreId = choreId || null;
    if (date !== undefined) updateData.date = new Date(date + "T12:00:00");
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl || null;

    const pointEntry = await prisma.pointEntry.update({
      where: { id },
      data: updateData,
      include: {
        chore: {
          select: { title: true },
        },
        createdBy: {
          select: { name: true, email: true },
        },
        updatedBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ pointEntry });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE /api/points/[id] - Delete a point entry (parent only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireFamily();

    if (session.user.role !== "PARENT") {
      return NextResponse.json(
        { error: "Only parents can delete points" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify point entry belongs to user's family
    const existingEntry = await prisma.pointEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Point entry not found" },
        { status: 404 }
      );
    }

    if (existingEntry.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Point entry belongs to another family" },
        { status: 403 }
      );
    }

    // Can't delete point entries linked to redemptions
    if (existingEntry.redemptionId) {
      return NextResponse.json(
        { error: "Cannot delete point entries linked to redemptions" },
        { status: 400 }
      );
    }

    await prisma.pointEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
