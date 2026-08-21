import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DAY_REWARDS,
  DEFAULT_DAY_TASKS,
  getDateKeyPT,
} from "@/lib/day-kiosk";

function parseDateParam(raw: string | null): string {
  const trimmed = raw?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : getDateKeyPT();
}

export async function GET(req: Request) {
  try {
    const selectedDate = parseDateParam(new URL(req.url).searchParams.get("date"));
    const entries = await prisma.pointEntry.findMany({
      select: {
        type: true,
        itemId: true,
        points: true,
        dateKey: true,
      },
    });

    let totalNet = 0;
    let selectedDayNet = 0;
    const taskPoints = new Map<string, number>();
    const rewardPoints = new Map<string, number>();

    for (const entry of entries) {
      totalNet += entry.points;
      if (entry.dateKey !== selectedDate) continue;

      selectedDayNet += entry.points;
      const totals = entry.type === "task" ? taskPoints : rewardPoints;
      totals.set(entry.itemId, (totals.get(entry.itemId) ?? 0) + entry.points);
    }

    const tasks = DEFAULT_DAY_TASKS.map((task) => ({
      ...task,
      completedCount: Math.max(
        0,
        Math.round((taskPoints.get(task.id) ?? 0) / task.defaultPoints),
      ),
    }));

    const rewards = DEFAULT_DAY_REWARDS.map((reward) => ({
      ...reward,
      redeemedCount: Math.max(
        0,
        Math.round(-(rewardPoints.get(reward.id) ?? 0) / reward.cost),
      ),
    }));

    return NextResponse.json({
      totalNet,
      selectedDate,
      selectedDayNet,
      tasks,
      rewards,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
