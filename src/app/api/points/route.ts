import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  isConfiguredPin,
  isValidSessionToken,
} from "@/lib/auth";
import {
  DEFAULT_REWARDS,
  DEFAULT_TASKS,
  getDateKeyPT,
} from "@/lib/points";
import { isValidDateKey, parsePointEvent } from "@/lib/point-event";

async function requireSession(): Promise<NextResponse | null> {
  const configuredPin = process.env.GEMSTEPS_PIN;
  if (!isConfiguredPin(configuredPin)) {
    return NextResponse.json({ error: "GEMSTEPS_PIN is not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(SESSION_COOKIE)?.value, configuredPin)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function parseDateParam(raw: string | null): string {
  const trimmed = raw?.trim() ?? "";
  return isValidDateKey(trimmed) ? trimmed : getDateKeyPT();
}

export async function GET(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

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
    let selectedDateNet = 0;
    const taskPoints = new Map<string, number>();
    const rewardPoints = new Map<string, number>();

    for (const entry of entries) {
      totalNet += entry.points;
      if (entry.dateKey !== selectedDate) continue;

      selectedDateNet += entry.points;
      const totals = entry.type === "task"
        ? taskPoints
        : entry.type === "reward"
          ? rewardPoints
          : null;
      if (totals) {
        totals.set(entry.itemId, (totals.get(entry.itemId) ?? 0) + entry.points);
      }
    }

    const tasks = DEFAULT_TASKS.map((task) => ({
      ...task,
      completedCount: Math.max(
        0,
        Math.round((taskPoints.get(task.id) ?? 0) / task.defaultPoints),
      ),
    }));

    const rewards = DEFAULT_REWARDS.map((reward) => ({
      ...reward,
      redeemedCount: Math.max(
        0,
        Math.round(-(rewardPoints.get(reward.id) ?? 0) / reward.cost),
      ),
    }));

    return NextResponse.json({
      totalNet,
      selectedDate,
      selectedDateNet,
      tasks,
      rewards,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const event = parsePointEvent(await req.json().catch(() => null));
    if (!event) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.pointEntry.findUnique({
        where: { id: event.id },
        select: { id: true },
      });
      if (existing) return "duplicate";

      const entries = await tx.pointEntry.findMany({
        select: {
          type: true,
          itemId: true,
          points: true,
          dateKey: true,
        },
      });

      const currentItemPoints = entries.reduce((sum, entry) => {
        return entry.type === event.type &&
          entry.itemId === event.itemId &&
          entry.dateKey === event.dateKey
          ? sum + entry.points
          : sum;
      }, 0);
      const currentTotal = entries.reduce((sum, entry) => sum + entry.points, 0);
      const nextItemPoints = currentItemPoints + event.points;
      const nextTotal = currentTotal + event.points;

      if (
        nextTotal < 0 ||
        (event.type === "task" && nextItemPoints < 0) ||
        (event.type === "reward" && nextItemPoints > 0)
      ) {
        return "rejected";
      }

      await tx.pointEntry.create({
        data: {
          id: event.id,
          type: event.type,
          itemId: event.itemId,
          points: event.points,
          dateKey: event.dateKey,
          date: new Date(event.date),
        },
      });
      return "applied";
    });

    if (outcome === "rejected") {
      return NextResponse.json({ error: "Event rejected" }, { status: 409 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
