import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_DAY_REWARDS, DEFAULT_DAY_TASKS, getDateKeyPT, parseDateFromNote, parseMarker } from "@/lib/day-kiosk";
import { verifyDayToken } from "@/lib/day-auth";

function parseDateParam(raw: string | null): string {
  if (!raw) return getDateKeyPT(new Date());
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return getDateKeyPT(new Date());
}

export async function GET(
  req: Request,
  { params }: { params: { kidId: string } },
) {
  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!verifyDayToken(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const kid = await prisma.user.findUnique({
      where: { id: params.kidId },
      select: { id: true, name: true, role: true, familyId: true },
    });

    if (!kid || kid.role !== "KID" || !kid.familyId) {
      return NextResponse.json({ error: "Kid not found" }, { status: 404 });
    }

    const date = parseDateParam(new URL(req.url).searchParams.get("date"));

    const entries = await prisma.pointEntry.findMany({
      where: { kidId: params.kidId },
      orderBy: { createdAt: "desc" },
      select: {
        points: true,
        note: true,
      },
    });

    const totals = entries.reduce(
      (acc, entry) => {
        const points = Number(entry.points);
        if (!Number.isFinite(points)) return acc;
        if (points > 0) acc.totalEarned += points;
        if (points < 0) acc.totalSpent += Math.abs(points);
        acc.totalNet += points;
        return acc;
      },
      { totalEarned: 0, totalSpent: 0, totalNet: 0 },
    );

    const selectedEntries = entries.filter((entry) => parseDateFromNote(entry.note) === date);

    const selectedDay = selectedEntries.reduce(
      (acc, entry) => {
        const points = Number(entry.points);
        if (!Number.isFinite(points)) return acc;
        if (points > 0) acc.earned += points;
        if (points < 0) acc.spent += Math.abs(points);
        acc.net += points;
        return acc;
      },
      { earned: 0, spent: 0, net: 0 },
    );

    const completedTaskIds = new Set<string>();
    selectedEntries.forEach((entry) => {
      const taskId = parseMarker("task", entry.note ?? null);
      if (taskId) completedTaskIds.add(taskId);
    });

    const completedRewardIds = new Set<string>();
    selectedEntries.forEach((entry) => {
      const rewardId = parseMarker("reward", entry.note ?? null);
      if (rewardId) completedRewardIds.add(rewardId);
    });

    const tasks = DEFAULT_DAY_TASKS.map((task) => ({
      ...task,
      completed: completedTaskIds.has(task.id),
    }));

    const rewards = DEFAULT_DAY_REWARDS.map((reward) => ({
      ...reward,
      completed: completedRewardIds.has(reward.id),
    }));

    return NextResponse.json({
      kid: { id: kid.id, name: kid.name },
      totals,
      selectedDate: date,
      selectedDay,
      tasks,
      rewards,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
