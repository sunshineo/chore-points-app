import { Prisma, type PrismaClient } from "@prisma/client";
import {
  DEFAULT_REWARDS,
  DEFAULT_TASKS,
  type PointEvent,
  type PointsState,
} from "@/lib/points";

const BALANCE_ID = "singleton";
export type LedgerOutcome = "applied" | "duplicate" | "rejected";

export async function applyPointEventToLedger(
  db: PrismaClient,
  event: PointEvent,
): Promise<LedgerOutcome> {
  return db.$transaction(async (tx) => {
    const [balance] = await tx.$queryRaw<Array<{ totalNet: number }>>`
      SELECT "totalNet"
      FROM "PointBalance"
      WHERE "id" = ${BALANCE_ID}
      FOR UPDATE
    `;
    if (!balance) throw new Error("PointBalance singleton is missing");

    const existing = await tx.pointEntry.findUnique({
      where: { id: event.id },
      select: { id: true },
    });
    if (existing) return "duplicate";

    const aggregate = event.type === "adjustment"
      ? null
      : await tx.pointEntry.aggregate({
          where: { type: event.type, itemId: event.itemId, dateKey: event.dateKey },
          _sum: { points: true },
        });
    const nextItemPoints = (aggregate?._sum.points ?? 0) + event.points;
    const nextTotal = balance.totalNet + event.points;
    const invalid = nextTotal < 0 ||
      (event.type === "task" && nextItemPoints < 0) ||
      (event.type === "reward" && nextItemPoints > 0);
    if (invalid) return "rejected";

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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function readPointsState(
  db: PrismaClient,
  selectedDate: string,
): Promise<PointsState> {
  return db.$transaction(async (tx) => {
    const balance = await tx.pointBalance.findUniqueOrThrow({
      where: { id: BALANCE_ID },
      select: { totalNet: true },
    });
    const groups = await tx.pointEntry.groupBy({
      by: ["type", "itemId"],
      where: { dateKey: selectedDate },
      _sum: { points: true },
    });

    let selectedDateNet = 0;
    const taskPoints = new Map<string, number>();
    const rewardPoints = new Map<string, number>();
    for (const group of groups) {
      const points = group._sum.points ?? 0;
      selectedDateNet += points;
      if (group.type === "task") taskPoints.set(group.itemId, points);
      if (group.type === "reward") rewardPoints.set(group.itemId, points);
    }

    return {
      totalNet: balance.totalNet,
      selectedDate,
      selectedDateNet,
      tasks: DEFAULT_TASKS.map((task) => ({
        ...task,
        completedCount: Math.max(
          0,
          Math.round((taskPoints.get(task.id) ?? 0) / task.defaultPoints),
        ),
      })),
      rewards: DEFAULT_REWARDS.map((reward) => ({
        ...reward,
        redeemedCount: Math.max(
          0,
          Math.round(-(rewardPoints.get(reward.id) ?? 0) / reward.cost),
        ),
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
