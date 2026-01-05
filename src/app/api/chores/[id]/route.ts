import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireParentInFamily } from "@/lib/permissions";

// PUT /api/chores/[id] - Update a chore
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireParentInFamily();
    const { id } = await params;
    const { title, defaultPoints, isActive, icon } = await req.json();

    // Verify chore belongs to user's family
    const existingChore = await prisma.chore.findUnique({
      where: { id },
    });

    if (!existingChore) {
      return NextResponse.json({ error: "Chore not found" }, { status: 404 });
    }

    if (existingChore.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Chore belongs to another family" },
        { status: 403 }
      );
    }

    const updateData: any = {
      updatedById: session.user.id,
    };

    if (title !== undefined) updateData.title = title;
    if (icon !== undefined) updateData.icon = icon || null;
    if (defaultPoints !== undefined) {
      if (typeof defaultPoints !== 'number' || defaultPoints < 0) {
        return NextResponse.json(
          { error: "defaultPoints must be a non-negative number" },
          { status: 400 }
        );
      }
      updateData.defaultPoints = defaultPoints;
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const chore = await prisma.chore.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        updatedBy: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ chore });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE /api/chores/[id] - Delete a chore
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireParentInFamily();
    const { id } = await params;

    // Verify chore belongs to user's family
    const existingChore = await prisma.chore.findUnique({
      where: { id },
    });

    if (!existingChore) {
      return NextResponse.json({ error: "Chore not found" }, { status: 404 });
    }

    if (existingChore.familyId !== session.user.familyId) {
      return NextResponse.json(
        { error: "Forbidden: Chore belongs to another family" },
        { status: 403 }
      );
    }

    await prisma.chore.delete({
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
