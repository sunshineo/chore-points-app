import { NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { getHueAuthUrl } from "@/lib/hue";

export async function GET() {
  try {
    const session = await requireParentInFamily();

    // Use familyId as state for CSRF protection
    const authUrl = getHueAuthUrl(session.user.familyId!);

    return NextResponse.json({ url: authUrl });
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
      { error: "Failed to initiate Hue authorization" },
      { status: 500 }
    );
  }
}
