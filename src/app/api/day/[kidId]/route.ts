import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DAY_REWARDS,
  DEFAULT_DAY_TASKS,
  DATE_MARKER_PREFIX,
  TASK_MARKER_PREFIX,
  REWARD_MARKER_PREFIX,
  getDateInPacific,
  getDateKeyPT,
  parseDateFromNote,
  parseMarker,
} from "@/lib/day-kiosk";
import { verifyDayToken } from "@/lib/day-auth";

function parseDateParam(raw: string | null): string {
  if (!raw) return getDateKeyPT(new Date());
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return getDateKeyPT(new Date());
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kidId: string }> },
) {
  const { kidId } = await params;
  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!verifyDayToken(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const kid = await prisma.user.findUnique({
      where: { id: kidId },
      select: { id: true, name: true, role: true, familyId: true },
    });

    if (!kid || kid.role !== "KID" || !kid.familyId) {
      return NextResponse.json({ error: "Kid not found" }, { status: 404 });
    }

    const date = parseDateParam(new URL(req.url).searchParams.get("date"));

    const nowDate = getDateInPacific(new Date());
    const fallbackDate = new Date(nowDate);
    fallbackDate.setDate(nowDate.getDate() - 1);
    const fallbackEarliest = getDateKeyPT(fallbackDate);

    const entries = await prisma.pointEntry.findMany({
      where: { kidId },
      orderBy: { createdAt: "desc" },
      select: {
        points: true,
        note: true,
      },
    });

    const isDayEntry = (note: string | null): boolean => {
      if (!note) return false;
      const hasTaskMarker = note.includes(`[${TASK_MARKER_PREFIX}`);
      const hasRewardMarker = note.includes(`[${REWARD_MARKER_PREFIX}`);
      const hasDateMarker = note.includes(`[${DATE_MARKER_PREFIX}`);
      return hasTaskMarker || hasRewardMarker || hasDateMarker;
    };

    const dayEntries = entries.filter((entry) => isDayEntry(entry.note));

    const earliestDate = dayEntries
      .map((entry) => parseDateFromNote(entry.note))
      .filter((noteDate): noteDate is string => Boolean(noteDate))
      .sort()
      [0] ?? fallbackEarliest;

    const totals = dayEntries.reduce(
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

    const selectedEntries = dayEntries.filter((entry) => parseDateFromNote(entry.note) === date);

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

    const taskNetById = new Map<string, number>();
    const rewardNetById = new Map<string, number>();

    selectedEntries.forEach((entry) => {
      const points = Number(entry.points);
      if (!Number.isFinite(points)) return;

      const taskId = parseMarker("task", entry.note ?? null);
      if (taskId) {
        taskNetById.set(taskId, (taskNetById.get(taskId) ?? 0) + points);
      }

      const rewardId = parseMarker("reward", entry.note ?? null);
      if (rewardId) {
        rewardNetById.set(rewardId, (rewardNetById.get(rewardId) ?? 0) + points);
      }
    });

    const tasks = DEFAULT_DAY_TASKS.map((task) => {
      const netPoints = taskNetById.get(task.id) ?? 0;
      const completedCount = Math.max(0, Math.round(netPoints / task.defaultPoints));

      return {
        ...task,
        completed: completedCount > 0,
        completedCount,
      };
    });

    const rewards = DEFAULT_DAY_REWARDS.map((reward) => ({
      ...reward,
      redeemedCount: Math.max(
        0,
        Math.round(-(rewardNetById.get(reward.id) ?? 0) / reward.cost),
      ),
    }));

    return NextResponse.json({
      kid: { id: kid.id, name: kid.name },
      earliestDate,
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
