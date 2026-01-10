import { NextResponse } from "next/server";
import { getSession } from "@/lib/permissions";
import { getValidAccessToken, listCalendars } from "@/lib/google-calendar";

// GET /api/calendar/calendars - List available Google calendars
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Parents only" }, { status: 403 });
    }

    // Get valid access token (will refresh if needed)
    const accessToken = await getValidAccessToken(session.user.id);

    // List all calendars
    const calendars = await listCalendars(accessToken);

    // Filter to only writable calendars
    const writableCalendars = calendars.filter(
      (cal) => cal.accessRole === "owner" || cal.accessRole === "writer"
    );

    return NextResponse.json({ calendars: writableCalendars });
  } catch (error) {
    console.error("Error listing calendars:", error);
    const message = error instanceof Error ? error.message : "Failed to list calendars";

    // Check if it's a token error
    if (message.includes("No Google account") || message.includes("refresh token")) {
      return NextResponse.json(
        { error: "Please sign in with Google to access calendars" },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
