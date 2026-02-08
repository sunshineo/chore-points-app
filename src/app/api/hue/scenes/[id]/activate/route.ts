import { NextRequest, NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { getHueAccessToken, activateHueScene } from "@/lib/hue";

export async function POST(
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
    const { groupId } = body;

    await activateHueScene(
      credentials.accessToken,
      credentials.username,
      id,
      groupId
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
      { error: "Failed to activate scene" },
      { status: 500 }
    );
  }
}
