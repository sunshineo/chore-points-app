import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/permissions";
import {
  getValidAccessToken,
  getEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/google-calendar";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

// GET /api/calendar/events/[eventId] - Get a single event
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
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

    if (!settings?.isConnected || !settings.selectedCalendarId || !settings.connectedByUserId) {
      return NextResponse.json(
        { error: "No calendar connected" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(settings.connectedByUserId);
    const event = await getEvent(
      accessToken,
      settings.selectedCalendarId,
      eventId
    );

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Error getting event:", error);
    const message = error instanceof Error ? error.message : "Failed to get event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/calendar/events/[eventId] - Update an event
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
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

    if (!settings?.isConnected || !settings.selectedCalendarId || !settings.connectedByUserId) {
      return NextResponse.json(
        { error: "No calendar connected" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { summary, description, startDate, endDate, allDay, location } = body;

    const accessToken = await getValidAccessToken(settings.connectedByUserId);

    const eventData = allDay
      ? {
          summary,
          description,
          location,
          start: startDate ? { date: startDate.split("T")[0] } : undefined,
          end: endDate ? { date: endDate.split("T")[0] } : undefined,
        }
      : {
          summary,
          description,
          location,
          start: startDate
            ? { dateTime: startDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
            : undefined,
          end: endDate
            ? { dateTime: endDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
            : undefined,
        };

    // Remove undefined values
    const cleanEventData = Object.fromEntries(
      Object.entries(eventData).filter(([, v]) => v !== undefined)
    );

    const event = await updateEvent(
      accessToken,
      settings.selectedCalendarId,
      eventId,
      cleanEventData
    );

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Error updating event:", error);
    const message = error instanceof Error ? error.message : "Failed to update event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/calendar/events/[eventId] - Delete an event
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params;
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

    if (!settings?.isConnected || !settings.selectedCalendarId || !settings.connectedByUserId) {
      return NextResponse.json(
        { error: "No calendar connected" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(settings.connectedByUserId);
    await deleteEvent(accessToken, settings.selectedCalendarId, eventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    const message = error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
