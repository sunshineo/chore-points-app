import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/permissions";

// GET /api/calendar/settings - Get calendar settings for the family
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    if (!session.user.familyId) {
      return NextResponse.json({ error: "No family" }, { status: 403 });
    }

    const settings = await prisma.calendarSettings.findUnique({
      where: { familyId: session.user.familyId },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error getting calendar settings:", error);
    return NextResponse.json(
      { error: "Failed to get calendar settings" },
      { status: 500 }
    );
  }
}

// PUT /api/calendar/settings - Update calendar settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    if (!session.user.familyId) {
      return NextResponse.json({ error: "No family" }, { status: 403 });
    }

    const body = await request.json();
    const { selectedCalendarId, selectedCalendarName } = body;

    const settings = await prisma.calendarSettings.upsert({
      where: { familyId: session.user.familyId },
      update: {
        selectedCalendarId,
        selectedCalendarName,
        isConnected: true,
        connectedByUserId: session.user.id,
        connectedAt: new Date(),
      },
      create: {
        familyId: session.user.familyId,
        selectedCalendarId,
        selectedCalendarName,
        isConnected: true,
        connectedByUserId: session.user.id,
        connectedAt: new Date(),
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating calendar settings:", error);
    return NextResponse.json(
      { error: "Failed to update calendar settings" },
      { status: 500 }
    );
  }
}

// DELETE /api/calendar/settings - Disconnect calendar
export async function DELETE() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    if (!session.user.familyId) {
      return NextResponse.json({ error: "No family" }, { status: 403 });
    }

    await prisma.calendarSettings.update({
      where: { familyId: session.user.familyId },
      data: {
        isConnected: false,
        selectedCalendarId: null,
        selectedCalendarName: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}
