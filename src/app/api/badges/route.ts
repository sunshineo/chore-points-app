import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFamily } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { getLevelInfo, getProgressToNextLevel } from "@/lib/badges";
import { getAchievementBadgeById } from "@/lib/achievement-badges";

// GET /api/badges - Get badges for the family
// Parents can see all badges, kids can only see their own
export async function GET(req: Request) {
  try {
    const session = await requireFamily();

    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get("kidId");

    const whereClause: { familyId: string; kidId?: string } = {
      familyId: session.user.familyId!,
    };

    // Kids can only see their own badges
    if (session.user.role === Role.KID) {
      whereClause.kidId = session.user.id;
    } else if (kidId) {
      // Parents can filter by kid
      whereClause.kidId = kidId;
    }

    const badges = await prisma.badge.findMany({
      where: whereClause,
      include: {
        kid: {
          select: { id: true, name: true },
        },
        chore: {
          select: { id: true, title: true, icon: true },
        },
      },
      orderBy: [
        { level: "desc" },
        { count: "desc" },
      ],
    });

    // Enrich with level info and progress
    const enrichedBadges = badges.map((badge) => {
      const levelInfo = getLevelInfo(badge.level);
      const progress = getProgressToNextLevel(badge.count);

      return {
        ...badge,
        levelName: levelInfo?.name || null,
        levelIcon: levelInfo?.icon || null,
        progress: progress.progress,
        nextLevelAt: progress.next,
      };
    });

    // Also get achievement badges
    const achievementBadges = await prisma.achievementBadge.findMany({
      where: whereClause,
      include: {
        kid: {
          select: { id: true, name: true },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    // Enrich achievement badges with definitions
    const enrichedAchievementBadges = achievementBadges.map((badge) => {
      const definition = getAchievementBadgeById(badge.badgeId);
      return {
        ...badge,
        name: definition?.name || badge.badgeId,
        nameZh: definition?.nameZh || badge.badgeId,
        description: definition?.description || "",
        descriptionZh: definition?.descriptionZh || "",
        icon: definition?.icon || "🏅",
      };
    });

    return NextResponse.json({
      badges: enrichedBadges,
      achievementBadges: enrichedAchievementBadges,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    if (message === "Unauthorized" || message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
