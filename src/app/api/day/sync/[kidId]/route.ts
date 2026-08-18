import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DAY_REWARDS,
  DEFAULT_DAY_TASKS,
  dateMarker,
  eventMarker,
  rewardMarker,
  taskMarker,
  DaySyncEvent,
  parseDateFromNote,
  parseMarker,
} from "@/lib/day-kiosk";
import { verifyDayToken } from "@/lib/day-auth";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REWARD_TYPES = new Set(["task", "reward"]);
const TASK_IDS = new Set(DEFAULT_DAY_TASKS.map((task) => task.id));
const REWARD_IDS = new Set(DEFAULT_DAY_REWARDS.map((reward) => reward.id));

function parseDateKey(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return DATE_KEY_RE.test(trimmed) ? trimmed : null;
}

function dateFromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ kidId: string }> },
) {
  const { kidId } = await params;
  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!verifyDayToken(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as { events?: DaySyncEvent[] } | null;
    const rawEvents = payload?.events;

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return NextResponse.json({ error: "Events are required" }, { status: 400 });
    }

    const kid = await prisma.user.findUnique({
      where: { id: kidId },
      select: { id: true, familyId: true, role: true },
    });

    if (!kid || kid.role !== "KID" || !kid.familyId) {
      return NextResponse.json({ error: "Kid not found" }, { status: 404 });
    }

    const result = {
      applied: 0,
      skipped: 0,
      failedEvents: [] as string[],
      failed: [] as string[],
    };

    const response = await prisma.$transaction(async (tx) => {
      const allEntries = await tx.pointEntry.findMany({
        where: { kidId },
        select: { points: true, note: true },
      });

      const taskPointsByDate = new Map<string, number>();
      const rewardPointsByDate = new Map<string, number>();

      allEntries.forEach((entry) => {
        const points = Number(entry.points);
        if (!Number.isFinite(points) || !entry.note) {
          return;
        }

        const dateKey = parseDateFromNote(entry.note);
        if (!dateKey) {
          return;
        }

        const taskId = parseMarker("task", entry.note);
        if (taskId) {
          const key = `${dateKey}|${taskId}`;
          taskPointsByDate.set(key, (taskPointsByDate.get(key) ?? 0) + points);
          return;
        }

        const rewardId = parseMarker("reward", entry.note);
        if (rewardId) {
          const key = `${dateKey}|${rewardId}`;
          rewardPointsByDate.set(key, (rewardPointsByDate.get(key) ?? 0) + points);
        }
      });

      let runningNet = allEntries.reduce((sum, entry) => sum + Number(entry.points), 0);
      const dedupe = new Set<string>();

      for (const event of rawEvents) {
        if (
          !isSafeId(event?.id) ||
          !REWARD_TYPES.has(event.type) ||
          !isSafeId(event.itemId) ||
          !isSafeId(event.note) ||
          typeof event.points !== "number" ||
          typeof event.date !== "string" ||
          !isSafeId(event.dateKey) ||
          !parseDateKey(event.dateKey)
        ) {
          if (isSafeId(event?.id)) {
            result.failedEvents.push(event.id);
          }
          continue;
        }

        if (dedupe.has(event.id)) {
          result.skipped += 1;
          continue;
        }
        dedupe.add(event.id);

        const eventId = event.id;
        const eventDateKey = parseDateKey(event.dateKey);
        if (!eventDateKey) {
          result.failedEvents.push(eventId);
          result.failed.push(eventId);
          continue;
        }

        const existing = await tx.pointEntry.findFirst({
          where: {
            kidId,
            note: { contains: eventMarker(eventId) },
          },
          select: { id: true },
        });

        if (existing) {
          result.skipped += 1;
          continue;
        }

        const taskDefaults = new Map(DEFAULT_DAY_TASKS.map((task) => [task.id, task.defaultPoints]));
        const rewardDefaults = new Map(DEFAULT_DAY_REWARDS.map((reward) => [reward.id, reward.cost]));

        if (event.type === "task") {
          if (!TASK_IDS.has(event.itemId) || !Number.isFinite(event.points) || event.points === 0) {
            result.failedEvents.push(eventId);
            result.failed.push(eventId);
            continue;
          }

          const expectedPoints = taskDefaults.get(event.itemId);
          if (!Number.isFinite(expectedPoints) || expectedPoints <= 0 || Math.abs(event.points) !== expectedPoints) {
            result.failedEvents.push(eventId);
            result.failed.push(eventId);
            continue;
          }

          const key = `${eventDateKey}|${event.itemId}`;
          const projectedTask = (taskPointsByDate.get(key) ?? 0) + event.points;
          if (projectedTask < 0) {
            result.failedEvents.push(eventId);
            result.failed.push(eventId);
            continue;
          }
          taskPointsByDate.set(key, projectedTask);
        }

        if (event.type === "reward") {
          if (!REWARD_IDS.has(event.itemId) || !Number.isFinite(event.points) || event.points === 0) {
            result.failedEvents.push(eventId);
            result.failed.push(eventId);
            continue;
          }

          const rewardCost = rewardDefaults.get(event.itemId);
          if (!Number.isFinite(rewardCost) || rewardCost <= 0 || Math.abs(event.points) !== rewardCost) {
            result.failedEvents.push(eventId);
            result.failed.push(eventId);
            continue;
          }

          const key = `${eventDateKey}|${event.itemId}`;
          const projectedReward = (rewardPointsByDate.get(key) ?? 0) + event.points;
          if (projectedReward > 0) {
            result.failedEvents.push(eventId);
            result.failed.push(eventId);
            continue;
          }
          rewardPointsByDate.set(key, projectedReward);
        }

        const projectedNet = runningNet + event.points;
        if (projectedNet < 0) {
          result.failedEvents.push(eventId);
          result.failed.push(eventId);
          continue;
        }

        const marker = event.type === "task" ? taskMarker(event.itemId) : rewardMarker(event.itemId);

        const safeDate = dateFromDateKey(eventDateKey);
        const eventNote = `${event.note.trim()}${marker}${dateMarker(eventDateKey)}${eventMarker(eventId)}`;
        await tx.pointEntry.create({
          data: {
            familyId: kid.familyId!,
            kidId,
            points: event.points,
            note: eventNote,
            date: Number.isFinite(new Date(event.date).getTime())
              ? new Date(event.date)
              : safeDate,
            createdById: kidId,
            updatedById: kidId,
          },
        });

        runningNet = projectedNet;
        result.applied += 1;
      }

      return { ...result, totalNet: runningNet };
    });

    if (response.failed.length > 0) {
      return NextResponse.json(
        {
          error: "无法应用这次操作，请重试",
          failedEvents: response.failedEvents,
          failed: response.failed,
          skipped: response.skipped,
          applied: response.applied,
          totalNet: response.totalNet,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      skipped: response.skipped,
      applied: response.applied,
      totalNet: response.totalNet,
      failedEvents: response.failedEvents,
      failed: response.failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
