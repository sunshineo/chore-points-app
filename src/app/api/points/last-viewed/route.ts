import { NextResponse } from "next/server";
import { requireFamily } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await requireFamily();
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get("kidId");

    // If user is a KID, use their own ID
    // If user is a PARENT with kidId param (view-as mode), use that kidId
    let targetKidId: string;

    if (session.user.role === Role.KID) {
      targetKidId = session.user.id;
    } else if (session.user.role === Role.PARENT && kidId) {
      // Verify the kid belongs to the same family
      const kid = await prisma.user.findFirst({
        where: {
          id: kidId,
          familyId: session.user.familyId,
          role: Role.KID,
        },
      });

      if (!kid) {
        return NextResponse.json(
          { error: "Kid not found in your family" },
          { status: 404 }
        );
      }
      targetKidId = kidId;
    } else {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: targetKidId },
      select: { lastViewedPoints: true },
    });

    return NextResponse.json({
      lastViewedPoints: user?.lastViewedPoints ?? 0,
    });
  } catch (error) {
    console.error("Failed to get last viewed points:", error);
    return NextResponse.json(
      { error: "Failed to get last viewed points" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireFamily();
    const { points, kidId } = await req.json();

    if (typeof points !== "number") {
      return NextResponse.json(
        { error: "Points must be a number" },
        { status: 400 }
      );
    }

    // If user is a KID, use their own ID
    // If user is a PARENT with kidId (view-as mode), use that kidId
    let targetKidId: string;

    if (session.user.role === Role.KID) {
      targetKidId = session.user.id;
    } else if (session.user.role === Role.PARENT && kidId) {
      // Verify the kid belongs to the same family
      const kid = await prisma.user.findFirst({
        where: {
          id: kidId,
          familyId: session.user.familyId,
          role: Role.KID,
        },
      });

      if (!kid) {
        return NextResponse.json(
          { error: "Kid not found in your family" },
          { status: 404 }
        );
      }
      targetKidId = kidId;
    } else {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: targetKidId },
      data: { lastViewedPoints: points },
    });

    return NextResponse.json({
      success: true,
      lastViewedPoints: user.lastViewedPoints,
    });
  } catch (error) {
    console.error("Failed to update last viewed points:", error);
    return NextResponse.json(
      { error: "Failed to update last viewed points" },
      { status: 500 }
    );
  }
}
