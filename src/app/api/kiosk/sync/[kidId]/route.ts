import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyKioskToken } from "../../verify/route";

type KioskSyncEvent = {
  id: string;
  points: number;
  note: string;
  choreTitle: string | null;
  date: string;
};

type SyncResult = {
  appliedEventIds: string[];
  skippedEventIds: string[];
  failedEventIds: string[];
};

function normalizeEvent(input: unknown): KioskSyncEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as {
    id?: unknown;
    points?: unknown;
    note?: unknown;
    choreTitle?: unknown;
    date?: unknown;
  };

  if (typeof raw.id !== "string" || raw.id.trim().length === 0) return null;

  const points = Number(raw.points);
  if (!Number.isFinite(points) || points === 0) return null;
  if (!Number.isInteger(points)) return null;
  if (typeof raw.note !== "string") return null;
  if (typeof raw.date !== "string") return null;

  const parsedDate = new Date(raw.date);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return {
    id: raw.id,
    points,
    note: raw.note,
    choreTitle: typeof raw.choreTitle === "string" ? raw.choreTitle : null,
    date: raw.date,
  };
}

function buildMarker(eventId: string): string {
  return `[kiosk-sync:${eventId}]`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kidId: string }> },
) {
  const { kidId } = await params;

  const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-kiosk-token") || "";
  if (!verifyKioskToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    events?: unknown;
  } | null;
  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
  }

  const rawEvents = body.events.map((item) => normalizeEvent(item)).filter(Boolean) as KioskSyncEvent[];
  const uniqueEvents = rawEvents.filter(
    (item, index, list) => index === list.findIndex((candidate) => candidate.id === item.id),
  );

  const result: SyncResult = {
    appliedEventIds: [],
    skippedEventIds: [],
    failedEventIds: [],
  };

  if (rawEvents.length === 0) {
    return NextResponse.json({ ...result, received: 0 }, { status: 200 });
  }

  const kid = await prisma.user.findUnique({
    where: { id: kidId, role: "KID" },
    select: { id: true, familyId: true },
  });
  if (!kid || !kid.familyId) {
    return NextResponse.json({ error: "Kid not found" }, { status: 404 });
  }

  const normalizer = uniqueEvents.map((event) => {
    const marker = buildMarker(event.id);
    return { ...event, marker };
  });

  await prisma.$transaction(async (tx) => {
    for (const event of normalizer) {
      const hasSyncMarker = await tx.pointEntry.findFirst({
        where: {
          kidId,
          note: { contains: event.marker },
        },
        select: { id: true },
      });

      if (hasSyncMarker) {
        result.skippedEventIds.push(event.id);
        continue;
      }

      const createdDate = new Date(event.date);
      if (Number.isNaN(createdDate.getTime())) {
        result.failedEventIds.push(event.id);
        continue;
      }

      await tx.pointEntry.create({
        data: {
          familyId: kid.familyId,
          kidId,
          choreId: null,
          points: event.points,
          note: `${event.note} ${event.marker}`,
          date: createdDate,
          createdById: kid.id,
          updatedById: kid.id,
        },
      });

      if (event.points > 0) {
        await tx.kidStats.upsert({
          where: { kidId },
          create: {
            kidId,
            familyId: kid.familyId,
            totalEarned: event.points,
            totalSpent: 0,
          },
          update: { totalEarned: { increment: event.points } },
        });
      } else {
        await tx.kidStats.upsert({
          where: { kidId },
          create: {
            kidId,
            familyId: kid.familyId,
            totalEarned: 0,
            totalSpent: Math.abs(event.points),
          },
          update: { totalSpent: { increment: Math.abs(event.points) } },
        });
      }

      result.appliedEventIds.push(event.id);
    }
  });

  return NextResponse.json(
    {
      ...result,
      received: uniqueEvents.length,
      applied: result.appliedEventIds.length,
      skipped: result.skippedEventIds.length,
      failed: result.failedEventIds.length,
    },
    { status: 200 },
  );
}
