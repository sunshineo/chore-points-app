"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DAY_TIMEZONE,
  DEFAULT_DAY_REWARDS,
  DEFAULT_DAY_TASKS,
  DayApiPayload,
  DaySyncEvent,
  DayApiTask,
  dateMarker,
  eventMarker,
  rewardMarker,
  taskMarker,
} from "@/lib/day-kiosk";

type TabKey = "tasks" | "rewards";
type KioskApiResponse = DayApiPayload;

type KioskResponseBody = {
  error?: string;
  message?: string;
  selectedDate?: string;
};

type KioskTileProps = {
  task: DayApiTask;
  onTap: () => void;
  colorIndex: number;
  disabled: boolean;
};

type RewardTileProps = {
  reward: KioskApiResponse["rewards"][number];
  onRedeem: () => void;
  disabled: boolean;
  enough: boolean;
};

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

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "tasks", label: "任务" },
  { key: "rewards", label: "奖励" },
];

const DEFAULT_PAYLOAD: KioskApiResponse = {
  kid: { id: "", name: null },
  totals: { totalEarned: 0, totalSpent: 0, totalNet: 0 },
  selectedDate: new Date().toLocaleDateString("en-CA", { timeZone: DAY_TIMEZONE }),
  selectedDay: { earned: 0, spent: 0, net: 0 },
  tasks: DEFAULT_DAY_TASKS.map((task) => ({ ...task, completed: false })),
  rewards: DEFAULT_DAY_REWARDS,
};

function getDateInPacific(now = new Date()): Date {
  const text = now.toLocaleString("en-US", { timeZone: DAY_TIMEZONE });
  return new Date(text);
}

function getDateKeyPT(now = new Date()): string {
  return getDateInPacific(now).toLocaleDateString("en-CA", { timeZone: DAY_TIMEZONE });
}

function dateLabelFromDate(date: Date): string {
  const resolved = getDateInPacific(date);
  const month = resolved.getMonth() + 1;
  const day = resolved.getDate();
  const weekday = resolved.toLocaleDateString("zh-CN", {
    timeZone: DAY_TIMEZONE,
    weekday: "long",
  });
  return `${month}月${day}日 ${weekday}`;
}

function TaskTile({ task, onTap, colorIndex, disabled }: KioskTileProps) {
  const tileState = disabled
    ? task.completed
      ? "已完成"
      : "待完成"
    : "点我完成";

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg p-3 min-h-[130px] transition-all duration-200 overflow-hidden bg-gradient-to-br ${TILE_COLORS[colorIndex % TILE_COLORS.length]} ${disabled ? "opacity-55" : ""}`}
    >
      <div className="absolute inset-0 bg-white/25 pointer-events-none" />
      <span className="relative z-10 text-3xl">{task.emoji}</span>
      <h3 className="relative z-10 mt-2 text-sm text-white font-bold text-center">{task.title}</h3>
      <p className="relative z-10 text-xs text-white/85 mt-1">+{task.defaultPoints} 分</p>
      <p className="relative z-10 mt-2 text-xs text-white/90">{tileState}</p>
      {task.completed ? <span className="absolute top-2 right-2 text-white text-lg font-black">✓</span> : null}
    </button>
  );
}

function RewardTile({ reward, onRedeem, disabled, enough }: RewardTileProps) {
  return (
    <button
      type="button"
      onClick={onRedeem}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg p-3 min-h-[130px] transition-all duration-200 overflow-hidden bg-gradient-to-br ${disabled ? "from-gray-400 to-gray-500" : TILE_COLORS[2]} ${disabled ? "opacity-55" : ""}`}
    >
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <span className="relative z-10 text-3xl">{reward.emoji}</span>
      <h3 className="relative z-10 mt-2 text-sm text-white font-bold text-center">{reward.title}</h3>
      <p className="relative z-10 text-xs text-white/80 text-center px-2">{reward.description}</p>
      <span className="relative z-10 mt-2 text-sm text-white">-{reward.cost} 分</span>
      <span className="relative z-10 mt-1 text-xs text-white/85">{enough ? "可兑换" : "积分不足"}</span>
      {reward.stock !== null ? <span className="relative z-10 text-xs text-white/90">库存 {reward.stock}</span> : null}
    </button>
  );
}

function normalizeApiPayload(payload: KioskApiResponse): KioskApiResponse {
  return {
    ...payload,
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
    tasks: (payload.tasks ?? []).map((task) => ({
      ...task,
      completed: Boolean(task.completed),
      defaultPoints: Number(task.defaultPoints),
    })),
    rewards: payload.rewards ?? DEFAULT_DAY_REWARDS,
  };
}

export default function DayKioskPage({ kidId, token }: { kidId: string; token: string }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [data, setData] = useState<KioskApiResponse>(DEFAULT_PAYLOAD);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedDate = useMemo(() => {
    const today = getDateInPacific();
    const target = new Date(today);
    target.setDate(today.getDate() + selectedDateOffset);
    return target;
  }, [selectedDateOffset]);

  const selectedDateKey = useMemo(() => getDateKeyPT(selectedDate), [selectedDate]);
  const selectedDateLabel = useMemo(() => dateLabelFromDate(selectedDate), [selectedDate]);
  const isToday = selectedDateOffset === 0;

  const loadState = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/day/${encodeURIComponent(kidId)}?token=${encodeURIComponent(token)}&date=${encodeURIComponent(selectedDateKey)}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as KioskResponseBody;
        throw new Error(body?.error ?? `请求失败：${response.status}`);
      }

      const payload = (await response.json()) as KioskApiResponse;
      setData(normalizeApiPayload(payload));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [kidId, token, selectedDateKey]);

  const syncEvent = useCallback(
    async (events: DaySyncEvent[]) => {
      if (events.length === 0) return;
      setSaving(true);

      try {
        const response = await fetch(
          `/api/day/sync/${encodeURIComponent(kidId)}?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events }),
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as KioskResponseBody;
          throw new Error(body?.error ?? `同步失败：${response.status}`);
        }

        const result = (await response.json()) as {
          failed?: string[];
          failedEvents?: string[];
          skipped?: number;
        };

        if ((result.failed?.length ?? 0) > 0 || (result.failedEvents?.length ?? 0) > 0) {
          throw new Error("积分不足，无法完成兑换");
        }
      } finally {
        setSaving(false);
      }
    },
    [kidId, token],
  );

  const handleTaskTap = useCallback(
    async (task: KioskApiResponse["tasks"][number]) => {
      if (!isToday || task.completed || saving) return;

      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        await syncEvent([
          {
            id: eventId,
            type: "task",
            itemId: task.id,
            points: task.defaultPoints,
            dateKey: selectedDateKey,
            date: new Date().toISOString(),
            note: `完成任务：${task.title} ${taskMarker(task.id)}${dateMarker(selectedDateKey)}${eventMarker(eventId)}`,
          },
        ]);
        await loadState();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "操作失败");
      }
    },
    [isToday, selectedDateKey, syncEvent, loadState, saving],
  );

  const handleRewardRedeem = useCallback(
    async (reward: KioskApiResponse["rewards"][number]) => {
      if (reward.cost > data.totals.totalNet || saving) return;
      if (reward.stock !== null && reward.stock <= 0) return;

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        await syncEvent([
          {
            id: eventId,
            type: "reward",
            itemId: reward.id,
            points: -Math.abs(reward.cost),
            dateKey: selectedDateKey,
            date: new Date().toISOString(),
            note: `兑换奖励：${reward.title} ${rewardMarker(reward.id)}${dateMarker(selectedDateKey)}${eventMarker(eventId)}`,
          },
        ]);
        await loadState();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "操作失败");
      }
    },
    [data.totals.totalNet, selectedDateKey, saving, syncEvent, loadState],
  );

  const handlePrevDay = useCallback(() => {
    setSelectedDateOffset((offset) => offset - 1);
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDateOffset((offset) => Math.min(offset + 1, 0));
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const taskSummary = useMemo(() => {
    const completed = data.tasks.filter((task) => task.completed).length;
    return `${completed}/${data.tasks.length}`;
  }, [data.tasks]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-lg">加载中...</div>;
  }

  if (errorMessage) {
    return <div className="min-h-screen flex items-center justify-center px-6 text-sm text-red-600">{errorMessage}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 px-4 py-4">
      <style>{`
        .day-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }
      `}</style>

      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-2xl bg-white/90 backdrop-blur shadow p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="rounded-lg bg-indigo-100 px-3 py-1 text-sm font-semibold"
            >
              前一天
            </button>
            <div className="text-sm font-semibold">{selectedDateLabel}</div>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={selectedDateOffset >= 0}
              className="rounded-lg bg-indigo-100 px-3 py-1 text-sm font-semibold disabled:opacity-40"
            >
              后一天
            </button>
          </div>

          <div className="mt-3 rounded-xl bg-indigo-700 text-white p-4 space-y-3">
            <div className="text-center">
              <p className="text-xs opacity-90">总得分 - 总兑换 = 当前可用积分</p>
              <p className="mt-1 text-4xl font-black leading-none tracking-wide">
                {data.totals.totalEarned} - {data.totals.totalSpent} = {data.totals.totalNet}
              </p>
              <p className="mt-2 grid grid-cols-3 text-xs opacity-85">
                <span>总得分</span>
                <span>总兑换</span>
                <span>当前可用积分</span>
              </p>
            </div>

            <div className="border-t border-white/30 pt-2 text-center">
              <p className="text-lg opacity-95">今日得分 - 今日兑换 = 今日净变化</p>
              <p className="mt-1 text-3xl font-black leading-none tracking-wide">
                {data.selectedDay.earned} - {data.selectedDay.spent} = {data.selectedDay.net >= 0 ? "+" : ""}
                {data.selectedDay.net}
              </p>
              <p className="mt-2 grid grid-cols-3 text-xs opacity-85">
                <span>今日得分</span>
                <span>今日兑换</span>
                <span>今日变化</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-3 py-2 font-bold ${active ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}
              >
                {tab.label}
                {tab.key === "tasks" ? `（${taskSummary}）` : ""}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-white/90 shadow p-3 min-h-[55vh] day-scroll overflow-y-auto">
          {activeTab === "tasks" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.tasks.map((task, index) => (
                <TaskTile
                  key={task.id}
                  task={task}
                  onTap={() => handleTaskTap(task)}
                  colorIndex={index}
                  disabled={!isToday || task.completed}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.rewards.map((reward) => {
                const enough = data.totals.totalNet >= reward.cost;
                const disabled = saving || reward.stock === 0 || !enough;
                return (
                  <RewardTile
                    key={reward.id}
                    reward={reward}
                    onRedeem={() => handleRewardRedeem(reward)}
                    disabled={disabled}
                    enough={enough}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
