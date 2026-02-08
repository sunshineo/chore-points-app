import { NextRequest, NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { getHueAccessToken, controlHueRoom } from "@/lib/hue";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireParentInFamily();
    const { id } = await context.params;

    const credentials = await getHueAccessToken(session.user.familyId!);
    if (!credentials) {
      return NextResponse.json(
        { error: "Hue not connected" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { on, brightness } = body;

    const options: { on?: boolean; brightness?: number } = {};
    if (on !== undefined) options.on = on;
    if (brightness !== undefined) options.brightness = brightness;

    await controlHueRoom(
      credentials.accessToken,
      credentials.username,
      id,
      options
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return NextResponse.json(
      { error: "Failed to control room" },
      { status: 500 }
    );
  }
}
