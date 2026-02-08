import { NextRequest, NextResponse } from "next/server";
import { requireParentInFamily } from "@/lib/permissions";
import { exchangeCodeForTokens, linkHueBridge } from "@/lib/hue";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await requireParentInFamily();

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL("/settings?hue_error=denied", request.url)
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code required" },
        { status: 400 }
      );
    }

    // Verify state matches familyId (CSRF protection)
    if (state !== session.user.familyId) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Link the bridge to get username
    const username = await linkHueBridge(tokens.accessToken);

    // Store tokens in database
    await prisma.family.update({
      where: { id: session.user.familyId! },
      data: {
        hueAccessToken: tokens.accessToken,
        hueRefreshToken: tokens.refreshToken,
        hueTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        hueUsername: username,
      },
    });

    return NextResponse.redirect(
      new URL("/settings?hue_connected=true", request.url)
    );
  } catch (error) {
    console.error("Hue callback error:", error);
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.redirect(
      new URL("/settings?hue_error=failed", request.url)
    );
  }
}
