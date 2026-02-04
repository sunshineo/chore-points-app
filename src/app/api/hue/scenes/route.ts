import { NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { getHueAccessToken, getHueScenes } from "@/lib/hue";

export async function GET() {
  try {
    const session = await requireParentInFamily();

    const credentials = await getHueAccessToken(session.user.familyId!);
    if (!credentials) {
      return NextResponse.json(
        { error: "Hue not connected" },
        { status: 400 }
      );
    }

    const scenes = await getHueScenes(
      credentials.accessToken,
      credentials.username
    );

    return NextResponse.json({ scenes });
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
      { error: "Failed to fetch scenes" },
      { status: 500 }
    );
  }
}
