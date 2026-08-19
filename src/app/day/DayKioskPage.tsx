"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAY_TIMEZONE,
  DayApiPayload,
  DayApiTask,
  DaySyncEvent,
  getDateKeyPT,
  getDateInPacific,
} from "@/lib/day-kiosk";

type TabKey = "tasks" | "rewards";

type DayTask = DayApiTask;

type KioskResponseBody = {
  error?: string;
  message?: string;
  selectedDate?: string;
};

type KioskApiResponse = DayApiPayload & {
  rewards: Array<DayApiPayload["rewards"][number] & { completed?: boolean }>;
};

type KioskTileProps = {
  task: DayTask;
  onTap: () => void;
  colorIndex: number;
  disabled: boolean;
};

type RewardTileProps = {
  reward: KioskApiResponse["rewards"][number];
  onRedeem: () => void;
  disabled: boolean;
};

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "tasks", label: "任务", emoji: "✅" },
  { key: "rewards", label: "奖励", emoji: "🎁" },
];

const TILE_COLORS = [
  "from-pink-400 to-pink-500",
  "from-purple-400 to-purple-500",
  "from-indigo-400 to-indigo-500",
  "from-blue-400 to-blue-500",
  "from-cyan-400 to-cyan-500",
  "from-teal-400 to-teal-500",
  "from-green-400 to-green-500",
  "from-yellow-400 to-yellow-500",
  "from-orange-400 to-orange-500",
  "from-red-400 to-red-500",
];

type SyncResult = {
  failed?: string[];
  failedEvents?: string[];
  skipped?: number;
  applied?: number;
  totalNet?: number;
  error?: string;
};

type QueuedSyncEvent = DaySyncEvent & { enqueuedAt: string };

const QUEUE_STORAGE_PREFIX = "day-kiosk-offline-queue";

function getQueueStorageKey(kidId: string): string {
  return `${QUEUE_STORAGE_PREFIX}:${kidId}`;
}

function safeParseNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeQueuedEvents(rawEvents: unknown): QueuedSyncEvent[] {
  if (!Array.isArray(rawEvents)) {
    return [];
  }

  return rawEvents
    .map((rawEvent) => {
      if (typeof rawEvent !== "object" || rawEvent === null) return null;
      const item = rawEvent as Record<string, unknown>;
      if (item.type !== "task" && item.type !== "reward") return null;
      if (typeof item.id !== "string" || item.id.trim().length === 0) return null;
      if (typeof item.itemId !== "string" || item.itemId.trim().length === 0) return null;
      if (typeof item.note !== "string" || item.note.trim().length === 0) return null;
      if (typeof item.dateKey !== "string" || item.dateKey.trim().length === 0) return null;
      if (typeof item.date !== "string" || item.date.trim().length === 0) return null;
      const points = Number(item.points);
      if (!Number.isFinite(points) || points === 0) return null;
      const enqueuedAt = typeof item.enqueuedAt === "string" ? item.enqueuedAt : new Date().toISOString();
      return {
        id: item.id,
        type: item.type,
        itemId: item.itemId,
        points,
        dateKey: item.dateKey,
        date: item.date,
        note: item.note,
        enqueuedAt,
      };
    })
    .filter((item): item is QueuedSyncEvent => item !== null);
}

function loadQueuedEvents(kidId: string): QueuedSyncEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const key = getQueueStorageKey(kidId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeQueuedEvents(parsed);
  } catch (_error) {
    return [];
  }
}

function saveQueuedEvents(kidId: string, events: QueuedSyncEvent[]) {
  if (typeof window === "undefined") return;
  const key = getQueueStorageKey(kidId);
  window.localStorage.setItem(key, JSON.stringify(events));
}

function applyQueuedEventToState(
  base: KioskApiResponse,
  event: DaySyncEvent,
  multiplier: number,
): KioskApiResponse {
  const next: KioskApiResponse = {
    ...base,
    tasks: [...base.tasks],
    rewards: [...base.rewards],
    totals: { ...base.totals },
    selectedDay: { ...base.selectedDay },
    kid: base.kid,
  };

  const deltaPoints = safeParseNumber(event.points) * multiplier;
  if (deltaPoints === 0) {
    return next;
  }

  if (deltaPoints > 0) {
    next.totals.totalEarned += deltaPoints;
    next.selectedDay.earned += event.dateKey === next.selectedDate ? deltaPoints : 0;
  } else {
    next.totals.totalSpent += Math.abs(deltaPoints);
    next.selectedDay.spent += event.dateKey === next.selectedDate ? Math.abs(deltaPoints) : 0;
  }

  next.totals.totalNet += deltaPoints;
  next.selectedDay.net += event.dateKey === next.selectedDate ? deltaPoints : 0;

  if (event.dateKey !== next.selectedDate) {
    return next;
  }

  if (event.type === "task") {
    const index = next.tasks.findIndex((task) => task.id === event.itemId);
    if (index >= 0) {
      const updatedTask = { ...next.tasks[index] };
      const perTaskPoints = safeParseNumber(updatedTask.defaultPoints);
      const countDelta = perTaskPoints > 0 ? deltaPoints / perTaskPoints : 0;
      updatedTask.completedCount = Math.max(0, Math.round((updatedTask.completedCount ?? 0) + countDelta));
      updatedTask.completed = updatedTask.completedCount > 0;
      next.tasks[index] = updatedTask;
    }
  }

  if (event.type === "reward") {
    const index = next.rewards.findIndex((reward) => reward.id === event.itemId);
    if (index >= 0) {
      const updatedReward = { ...next.rewards[index] };
      const redeemedDelta = deltaPoints < 0 ? 1 : -1;
      updatedReward.redeemedCount = Math.max(0, (updatedReward.redeemedCount ?? 0) + redeemedDelta);
      next.rewards[index] = updatedReward;
    }
  }

  return next;
}

function applyQueuedEventsToState(base: KioskApiResponse, events: QueuedSyncEvent[]): KioskApiResponse {
  let next: KioskApiResponse = base;
  for (const event of events) {
    next = applyQueuedEventToState(next, event, 1);
  }
  return next;
}

function getChoreEmoji(task: { emoji: string; title: string }): string {
  if (task.emoji) {
    return task.emoji;
  }

  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const match = task.title.match(emojiRegex);
  if (match?.[0]) {
    return match[0];
  }

  return "⭐";
}

function ChoreTile({ task, onTap, colorIndex, disabled }: KioskTileProps) {
  const gradient = TILE_COLORS[colorIndex % TILE_COLORS.length];
  const emoji = getChoreEmoji(task);
  const completedCount = Number(task.completedCount ?? 0);

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-500 select-none text-white overflow-hidden bg-gradient-to-br ${gradient}`}
      style={{ width: 165, height: 165, opacity: disabled ? 0.55 : 1 }}
    >
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <div
        className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${
          completedCount > 0 ? "bg-emerald-500 text-white" : "bg-gray-500 text-white"
        }`}
      >
        {completedCount}
      </div>
      <span className="relative z-10 text-5xl" style={{ lineHeight: 1 }}>
        {emoji}
      </span>
      <h3
        className="relative z-10 mt-2 font-bold text-sm leading-tight text-center px-2 text-white"
        style={{ maxWidth: 150, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      >
        {task.title}
      </h3>
      <span
        className={`relative z-10 mt-2 rounded-full px-4 py-1.5 text-base font-black ${
          task.completed ? "bg-white/40" : "bg-white/30"
        }`}
      >
        +{task.defaultPoints} 分
      </span>
    </button>
  );
}

function RewardTile({ reward, onRedeem, disabled }: RewardTileProps) {
  const gradient = TILE_COLORS[Math.abs(reward.id.length) % TILE_COLORS.length];
  const redeemedCount = Number(reward.redeemedCount ?? 0);

  return (
    <button
      type="button"
      onClick={onRedeem}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-500 select-none text-white overflow-hidden bg-gradient-to-br ${gradient}`}
      style={{ width: 165, height: 165, opacity: disabled ? 0.55 : 1 }}
    >
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <div
        className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${
          disabled ? "bg-gray-500 text-white" : "bg-rose-500 text-white"
        }`}
      >
        {redeemedCount}
      </div>
      <span className="relative z-10 text-5xl" style={{ lineHeight: 1 }}>{reward.emoji}</span>
      <h3
        className="relative z-10 mt-2 font-bold text-sm leading-tight text-center px-2 text-white"
        style={{ maxWidth: 150, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      >
        {reward.title}
      </h3>
      <span
        className={`relative z-10 mt-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
          disabled ? "bg-white/20" : "bg-white/35"
        }`}
      >
        -{reward.cost} 分
      </span>
    </button>
  );
}

function TaskSection({
  tasks,
  onTap,
  readOnly,
  isUndoMode,
}: { tasks: DayTask[]; onTap: (id: string) => void; readOnly: boolean; isUndoMode: boolean }) {
  if (tasks.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-lg">这组还没有任务</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {tasks.map((task, i) => (
          <ChoreTile
            key={task.id}
            task={task}
            colorIndex={i}
            disabled={readOnly || (isUndoMode && Number(task.completedCount || 0) <= 0)}
            onTap={() => onTap(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RewardSection({
  rewards,
  onRedeem,
  currentPoints,
  disabled,
  isUndoMode,
}: {
  rewards: KioskApiResponse["rewards"];
  onRedeem: (id: string) => void;
  currentPoints: number;
  disabled: boolean;
  isUndoMode: boolean;
}) {
  if (rewards.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-lg">暂无奖励配置</div>;
  }

  return (
    <div className="pr-1">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {rewards.map((reward, i) => {
          const canUse = reward.stock === null ? true : reward.stock > 0;
          const enough = currentPoints >= reward.cost;
          const redeemedCount = Number(reward.redeemedCount ?? 0);
          const isDisabled = disabled || (isUndoMode ? redeemedCount <= 0 : !canUse || !enough);
          return (
            <RewardTile
              key={reward.id + i}
              reward={reward}
              disabled={isDisabled}
              onRedeem={() => onRedeem(reward.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function RainParticle({ emoji }: { emoji: string }) {
  const left = useRef(Math.random() * 100).current;
  const delay = useRef(Math.random() * 0.8).current;
  const duration = useRef(1.5 + Math.random() * 1).current;
  const size = useRef(20 + Math.random() * 20).current;

  return (
    <span
      className="absolute pointer-events-none kiosk-gem-rain"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        fontSize: `${size}px`,
        top: "-40px",
      }}
    >
      {emoji}
    </span>
  );
}

export default function DayKioskPage({ kidId, token }: { kidId: string; token: string }) {
  const [data, setData] = useState<KioskApiResponse | null>(null);
  const [pendingEvents, setPendingEvents] = useState<QueuedSyncEvent[]>(() => loadQueuedEvents(kidId));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [celebEmoji, setCelebEmoji] = useState("⭐");
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [undoMode, setUndoMode] = useState(false);
  const pendingEventsRef = useRef(pendingEvents);
  const syncingRef = useRef(false);

  const fallbackEarliestDate = useMemo(() => {
    const nowDate = getDateInPacific(new Date());
    const candidate = new Date(nowDate);
    candidate.setDate(nowDate.getDate() - 1);
    return getDateKeyPT(candidate);
  }, []);

  const selectedDate = useMemo(() => {
    const today = getDateInPacific(new Date()) as Date;
    const target = new Date(today);
    target.setDate(today.getDate() + selectedDateOffset);
    return target;
  }, [selectedDateOffset]);

  const selectedDateKey = useMemo(() => getDateKeyPT(selectedDate), [selectedDate]);
  const selectedDateDateLabel = useMemo(() => {
    const month = selectedDate.getMonth() + 1;
    const day = selectedDate.getDate();
    return `${month}月${day}日`;
  }, [selectedDate]);
  const selectedWeekdayLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString("zh-CN", {
        timeZone: DAY_TIMEZONE,
        weekday: "long",
      }),
    [selectedDate],
  );
  const selectedDateTasks = useMemo(() => (data ? data.tasks : []), [data]);
  const selectedDayNet = data?.selectedDay.net ?? 0;
  const totalNetPoints = data?.totals.totalNet ?? 0;
  const earliestDateKey = data?.earliestDate || fallbackEarliestDate;
  const canGoPrevDay = selectedDateKey > earliestDateKey;

  const isToday = selectedDateOffset === 0;

  useEffect(() => {
    pendingEventsRef.current = pendingEvents;
  }, [pendingEvents]);

  useEffect(() => {
    saveQueuedEvents(kidId, pendingEvents);
  }, [kidId, pendingEvents]);

  const loadState = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/day/${encodeURIComponent(kidId)}?token=${encodeURIComponent(token)}&date=${encodeURIComponent(selectedDateKey)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as KioskResponseBody;
        throw new Error(body?.error ?? `加载失败：${response.status}`);
      }

      const payload = (await response.json()) as KioskApiResponse;
      const safeTasks = payload.tasks.map((task) => ({
        ...task,
        completed: Boolean(task.completed),
        completedCount: Number(task.completedCount || 0),
        defaultPoints: Number(task.defaultPoints || 0),
      }));

      const safeRewards = payload.rewards.map((reward) => ({
        ...reward,
        cost: Number(reward.cost || 0),
      }));

      const normalized = {
        ...payload,
        tasks: safeTasks,
        rewards: safeRewards,
        totals: {
          totalEarned: Number(payload.totals?.totalEarned ?? 0),
          totalSpent: Number(payload.totals?.totalSpent ?? 0),
          totalNet: Number(payload.totals?.totalNet ?? 0),
        },
        selectedDay: {
          earned: Number(payload.selectedDay?.earned ?? 0),
          spent: Number(payload.selectedDay?.spent ?? 0),
          net: Number(payload.selectedDay?.net ?? 0),
        },
      } as KioskApiResponse;

      const mergedData = applyQueuedEventsToState(normalized, pendingEventsRef.current);
      setData(mergedData);
      setTotalPoints(mergedData.totals.totalNet);
      setDisplayedPoints((prev) => prev || mergedData.totals.totalNet);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [kidId, token, selectedDateKey]);

  const syncEvents = useCallback(async (events: QueuedSyncEvent[]) => {
    if (events.length === 0) return null;
    const response = await fetch(`/api/day/sync/${encodeURIComponent(kidId)}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });

    const result = (await response.json().catch(() => null)) as SyncResult | null;

    const safeResult: SyncResult = result && typeof result === "object" ? result : {};

    if (!response.ok) {
      return {
        ...safeResult,
        failed: safeResult?.failed ?? [events[0]?.id],
        error: safeResult?.error || `同步失败：${response.status}`,
      };
    }

    return safeResult;
  }, [kidId, token]);

  const drainPendingEvents = useCallback(async () => {
    if (syncingRef.current) return;
    let queue = [...pendingEventsRef.current];
    if (queue.length === 0) return;
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      setErrorMessage("当前离线，操作已暂存，恢复联网后自动上传");
      return;
    }

    syncingRef.current = true;
    

    try {
      while (queue.length > 0) {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
          setErrorMessage("当前离线，操作已暂存，恢复联网后自动上传");
          break;
        }

        const event = queue[0];
        const result = await syncEvents([event]);
        const isFailed = (result?.failed ?? []).includes(event.id) || (result?.failedEvents ?? []).includes(event.id);

        if (!result || typeof result.totalNet !== "number") {
          setErrorMessage("同步失败，操作已暂存，稍后重试");
          break;
        }

        if (isFailed) {
          queue = queue.filter((item) => item.id !== event.id);
          pendingEventsRef.current = queue;
          setPendingEvents(queue);
          setData((prev) => (prev ? applyQueuedEventToState(prev, event, -1) : prev));
          setTotalPoints((prev) => prev - event.points);
          setErrorMessage("同步校验失败，已回退该操作");
          continue;
        }

        queue = queue.slice(1);
        pendingEventsRef.current = queue;
        setPendingEvents(queue);

        const nextTotalNet = safeParseNumber(result.totalNet);
        setTotalPoints(nextTotalNet);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totals: {
              ...prev.totals,
              totalNet: nextTotalNet,
            },
          };
        });
      }

      if (pendingEventsRef.current.length === 0) {
        setErrorMessage(null);
      }
    } catch (_error) {
      setErrorMessage("同步失败，操作已暂存，稍后重试");
    } finally {
      
      syncingRef.current = false;
      if (queue.length === 0 && typeof window !== "undefined" && window.navigator.onLine) {
        // Keep data updates optimistic/local; avoid forcing a full loading state refresh.
      }
    }
  }, [loadState, syncEvents]);

  const runCelebration = useCallback((entryEmoji: string) => {
    setCelebEmoji(entryEmoji);
    setShowEmoji(true);
    setShowRain(false);

    setTimeout(() => {
      setShowEmoji(false);
      setShowRain(true);
      setTimeout(() => setShowRain(false), 2500);
    }, 3500);
  }, []);

  const enqueueAndApplyEvent = useCallback(
    (event: DaySyncEvent) => {
      if (!data) return;
      const pending: QueuedSyncEvent = { ...event, enqueuedAt: new Date().toISOString() };

      setData((prev) => {
        if (!prev) return prev;
        const next = applyQueuedEventToState(prev, pending, 1);
        setTotalPoints(next.totals.totalNet);
        return next;
      });

      const nextQueue = [...pendingEventsRef.current, pending];
      pendingEventsRef.current = nextQueue;
      setPendingEvents(nextQueue);
      setErrorMessage(null);
      void drainPendingEvents();
    },
    [data, drainPendingEvents],
  );

  useEffect(() => {
    void loadState(true);
    void drainPendingEvents();
  }, [loadState, drainPendingEvents, selectedDateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      void drainPendingEvents();
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [drainPendingEvents]);

  useEffect(() => {
    const start = displayedPoints;
    const end = totalPoints;
    if (start === end) return;

    const diff = end - start;
    const steps = Math.min(Math.abs(diff), 30);
    const stepDuration = 600 / steps;
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      const progress = step / steps;
      setDisplayedPoints(Math.round(start + diff * progress));
      if (step >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [displayedPoints, totalPoints]);

  const handleTaskTap = useCallback(
    (task: DayTask) => {
      if (!data || !isToday) return;
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const notePrefix = "完成任务";
      const event: DaySyncEvent = {
        id: eventId,
        type: "task",
        itemId: task.id,
        points: Math.abs(task.defaultPoints),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
        note: `${notePrefix}：${task.title} [day-task:${task.id}][day-date:${selectedDateKey}][day-event:${eventId}]`,
      };
      enqueueAndApplyEvent(event);
      runCelebration(task.emoji);
    },
    [data, isToday, enqueueAndApplyEvent, runCelebration, selectedDateKey],
  );

  const handleTaskUndo = useCallback(
    (task: DayTask) => {
      if (!data || !isToday) return;
      if (Number(task.completedCount ?? 0) <= 0) return;
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const notePrefix = "撤销任务";
      const event: DaySyncEvent = {
        id: eventId,
        type: "task",
        itemId: task.id,
        points: -Math.abs(task.defaultPoints),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
        note: `${notePrefix}：${task.title} [day-task:${task.id}][day-date:${selectedDateKey}][day-event:${eventId}]`,
      };
      enqueueAndApplyEvent(event);
    },
    [data, isToday, enqueueAndApplyEvent, selectedDateKey],
  );

  const handleRewardRedeem = useCallback(
    (reward: KioskApiResponse["rewards"][number]) => {
      if (!data || !isToday) return;
      if (reward.stock !== null && reward.stock <= 0) return;
      if (totalNetPoints < reward.cost) return;

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const notePrefix = "兑换奖励";
      const event: DaySyncEvent = {
        id: eventId,
        type: "reward",
        itemId: reward.id,
        points: -Math.abs(reward.cost),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
        note: `${notePrefix}：${reward.title} [day-reward:${reward.id}][day-date:${selectedDateKey}][day-event:${eventId}]`,
      };
      enqueueAndApplyEvent(event);
    },
    [data, isToday, enqueueAndApplyEvent, selectedDateKey, totalNetPoints],
  );

  const handleRewardUndo = useCallback(
    (reward: KioskApiResponse["rewards"][number]) => {
      if (!data || !isToday) return;
      const redeemedCount = Number(reward.redeemedCount ?? 0);
      if (redeemedCount <= 0) return;

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const notePrefix = "撤销奖励";
      const event: DaySyncEvent = {
        id: eventId,
        type: "reward",
        itemId: reward.id,
        points: Math.abs(reward.cost),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
        note: `${notePrefix}：${reward.title} [day-reward:${reward.id}][day-date:${selectedDateKey}][day-event:${eventId}]`,
      };
      enqueueAndApplyEvent(event);
    },
    [data, isToday, enqueueAndApplyEvent, selectedDateKey],
  );

  const handleTaskCardTap = useCallback(
    (taskId: string) => {
      const task = data?.tasks.find((item) => item.id === taskId);
      if (!task) return;
      if (undoMode) {
        void handleTaskUndo(task);
      } else {
        void handleTaskTap(task);
      }
    },
    [data, handleTaskTap, handleTaskUndo, undoMode],
  );

  const handleRewardCardTap = useCallback(
    (rewardId: string) => {
      const reward = data?.rewards.find((item) => item.id === rewardId);
      if (!reward) return;

      if (undoMode) {
        void handleRewardUndo(reward);
      } else {
        void handleRewardRedeem(reward);
      }
    },
    [data, handleRewardRedeem, handleRewardUndo, undoMode],
  );

  const handlePrevDay = useCallback(() => {
    if (!canGoPrevDay) return;
    setSelectedDateOffset((offset) => offset - 1);
  }, [canGoPrevDay]);

  const handleNextDay = useCallback(() => {
    setSelectedDateOffset((offset) => Math.min(offset + 1, 0));
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-4xl animate-pulse">⏳</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-sm text-red-600">
        <div>加载失败：{errorMessage ?? "未知错误"}</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes kiosk-gem-rain-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(360deg); opacity: 0; }
        }
        @keyframes kiosk-counter-bump {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes kiosk-emoji-bounce {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.08) translateY(-12px); }
        }
        .kiosk-gem-rain { animation: kiosk-gem-rain-fall 2s ease-in forwards; }
        .kiosk-counter-bump { animation: kiosk-counter-bump 0.4s ease-out; }
        .kiosk-emoji-bounce { animation: kiosk-emoji-bounce 0.7s ease-in-out infinite; }
        .kiosk-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; }
      `}</style>

      <div
        className="relative grid grid-rows-[auto_1fr] min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
      >
        <div className="text-white flex-shrink-0 relative overflow-hidden px-6 py-3 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
          <div className="relative z-20 flex flex-col gap-3">
            <div className="flex items-center justify-start gap-3">
              <div className="flex-1 z-10">
                <div className="flex items-center gap-4 text-7xl leading-none font-black tracking-tight">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-600 shadow-lg" />
                    <div className="absolute inset-2 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-700" />
                    <div className="absolute top-2 left-3 w-3 h-4 bg-yellow-200 rounded-full opacity-60 blur-[1px]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-yellow-900 font-bold text-lg opacity-70">★</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>{displayedPoints}</span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 z-10 flex items-center justify-end gap-2 text-right">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  disabled={!canGoPrevDay}
                  className="px-4 py-1.5 rounded-lg bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/25 text-lg"
                >
                  前一天
                </button>
                <p className="text-base font-semibold text-white/95">{selectedDateDateLabel}</p>
                <p className="text-base font-semibold text-white/95">{selectedWeekdayLabel}</p>
                <p
                  className={`text-2xl font-semibold ${
                    selectedDayNet > 0
                      ? "text-emerald-300"
                      : selectedDayNet < 0
                        ? "text-rose-300"
                        : "text-white"
                  }`}
                >
                  {selectedDayNet > 0 ? "+" : ""}
                  {selectedDayNet}
                </p>
                <button
                  type="button"
                  onClick={handleNextDay}
                  disabled={selectedDateOffset >= 0}
                  className="px-4 py-1.5 rounded-lg bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/25 text-lg"
                >
                  后一天
                </button>
                <button
                  type="button"
                  onClick={() => setUndoMode((value) => !value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                    undoMode ? "bg-rose-100 text-rose-700" : "bg-white/15 text-white"
                  }`}
                >
                  {undoMode ? "退出撤销" : "撤销模式"}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="text-sm text-rose-100 text-center">{errorMessage}</div>
            ) : null}
            {undoMode ? (
              <div className="text-xs text-white/90 mt-1">撤销模式：点击可撤销的卡片会执行撤销</div>
            ) : null}
          </div>
        </div>

        <div className="relative">
          {(showEmoji || showRain) && (
            <div
              className="fixed inset-0 z-30 pointer-events-none"
              style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)" }}
            >
              <div className="relative h-full w-full overflow-hidden">
                {showEmoji ? (
                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center"
                  >
                    <div className="kiosk-emoji-bounce" style={{ fontSize: 160, lineHeight: 1 }}>
                      {celebEmoji}
                    </div>
                  </div>
                ) : null}
                {showRain ? (
                  <div className="absolute inset-0 overflow-hidden">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <RainParticle key={i} emoji={celebEmoji} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="flex px-4 pt-3 pb-1 gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3.5 rounded-xl font-bold transition-all duration-200 ${
                isActive ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-500 border-2 border-gray-200"
              }`}
            >
              <span style={{ fontSize: 22 }}>{tab.emoji}</span>
              <span className="ml-1 text-lg">{tab.label}</span>
            </button>
          );
        })}
          </div>

          <div className="px-6 py-4 overflow-x-hidden pt-0 pb-6">
        {activeTab === "rewards" ? (
              <RewardSection
                rewards={data.rewards}
                currentPoints={totalNetPoints}
                disabled={!isToday}
                isUndoMode={undoMode}
                onRedeem={handleRewardCardTap}
              />
            ) : (
              <TaskSection
                tasks={selectedDateTasks}
                onTap={handleTaskCardTap}
                readOnly={!isToday}
                isUndoMode={undoMode}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
