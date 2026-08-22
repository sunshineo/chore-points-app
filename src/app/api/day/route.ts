import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  KIOSK_SESSION_COOKIE,
  isConfiguredKioskPin,
  isValidKioskSessionToken,
} from "@/lib/kiosk-auth";
import {
  DEFAULT_DAY_REWARDS,
  DEFAULT_DAY_TASKS,
  getDateKeyPT,
  type DaySyncEvent,
} from "@/lib/day-kiosk";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_POINTS = new Map(DEFAULT_DAY_TASKS.map((task) => [task.id, task.defaultPoints]));
const REWARD_COSTS = new Map(DEFAULT_DAY_REWARDS.map((reward) => [reward.id, reward.cost]));

async function requireKioskSession(): Promise<NextResponse | null> {
  const configuredPin = process.env.KIOSK_PIN;
  if (!isConfiguredKioskPin(configuredPin)) {
    return NextResponse.json({ error: "KIOSK_PIN is not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  if (!isValidKioskSessionToken(cookieStore.get(KIOSK_SESSION_COOKIE)?.value, configuredPin)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function parseDateParam(raw: string | null): string {
  const trimmed = raw?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : getDateKeyPT();
}

function isValidEvent(value: unknown): value is DaySyncEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DaySyncEvent>;
  const expectedPoints = event.type === "task"
    ? TASK_POINTS.get(event.itemId ?? "")
    : event.type === "reward"
      ? REWARD_COSTS.get(event.itemId ?? "")
      : undefined;

  return (
    typeof event.id === "string" &&
    event.id.length > 0 &&
    typeof event.itemId === "string" &&
    expectedPoints !== undefined &&
    typeof event.points === "number" &&
    event.points !== 0 &&
    Math.abs(event.points) === expectedPoints &&
    typeof event.dateKey === "string" &&
    DATE_KEY_RE.test(event.dateKey) &&
    typeof event.date === "string" &&
    Number.isFinite(new Date(event.date).getTime())
  );
}

export async function GET(req: Request) {
  const unauthorized = await requireKioskSession();
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

export async function POST(req: Request) {
  const unauthorized = await requireKioskSession();
  if (unauthorized) return unauthorized;

  try {
    const event = await req.json().catch(() => null);
    if (!isValidEvent(event)) {
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
