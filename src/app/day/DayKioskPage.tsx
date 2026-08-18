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
  completed: boolean;
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
  const tileState = task.completed ? "已完成" : disabled ? "锁定" : "点我完成";
  const statusStyle = task.completed
    ? "bg-emerald-500 text-white"
    : disabled
      ? "bg-sky-500 text-white"
      : "bg-rose-500 text-white";

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-300 select-none text-white overflow-hidden bg-gradient-to-br ${TILE_COLORS[colorIndex % TILE_COLORS.length]} ${disabled ? "opacity-55" : ""}`}
      style={{ width: 165, height: 165, opacity: disabled || task.completed ? 0.55 : 1 }}
    >
      <div className="absolute inset-0 bg-white/25 pointer-events-none" />
      <div className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${statusStyle}`}>
        {task.completed ? "✓" : disabled ? "锁" : "!"}
      </div>
      <span className="relative z-10 text-5xl leading-none" role="img" aria-label={task.title}>
        {task.emoji}
      </span>
      <h3
        className="relative z-10 mt-2 text-sm font-bold leading-tight text-center px-2 text-white"
        style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      >
        {task.title}
      </h3>
      <span className="relative z-10 mt-2 rounded-full px-3 py-1 text-sm font-bold bg-white/35">
        +{task.defaultPoints} 分
      </span>
      <p className="relative z-10 mt-2 text-[11px] text-white/85">{tileState}</p>
    </button>
  );
}

function RewardTile({ reward, onRedeem, disabled, enough }: RewardTileProps) {
  const statusStyle = enough ? "bg-rose-500 text-white" : "bg-gray-500 text-white";

  return (
    <button
      type="button"
      onClick={onRedeem}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-300 select-none text-white overflow-hidden bg-gradient-to-br ${disabled ? "from-gray-400 to-gray-500" : TILE_COLORS[2]} ${disabled ? "opacity-55" : ""}`}
      style={{ width: 165, height: 165, opacity: disabled ? 0.55 : 1 }}
    >
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <div className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${statusStyle}`}>
        {reward.stock === null ? "∞" : reward.stock}
      </div>
      <span className="relative z-10 text-5xl leading-none" role="img" aria-label={reward.title}>
        {reward.emoji}
      </span>
      <h3
        className="relative z-10 mt-2 text-sm font-bold leading-tight text-center px-2 text-white"
        style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      >
        {reward.title}
      </h3>
      <p className="relative z-10 text-xs text-white/80 text-center px-2 mt-1">{reward.description}</p>
      <span className="relative z-10 mt-2 text-sm font-bold">-{reward.cost} 分</span>
      <span className="relative z-10 mt-1 text-xs text-white/85">今日兑换 {reward.redeemedCount ?? 0} 次</span>
      <span className="relative z-10 mt-1 text-xs text-white/85">{enough ? "可兑换" : "积分不足"}</span>
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
    rewards: (payload.rewards ?? DEFAULT_DAY_REWARDS).map((reward) => ({
      ...reward,
      stock: reward.stock ?? null,
      redeemedCount: Number(reward.redeemedCount ?? 0),
    })),
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
    <div className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <style>{`
        .day-scroll {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          touch-action: pan-y;
        }
      `}</style>

      <div className="text-white flex-shrink-0 relative overflow-hidden px-6 py-3 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
        <div className="relative z-20 flex flex-col gap-3 max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handlePrevDay}
              className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-sm"
            >
              前一天
            </button>
            <p className="text-sm font-semibold text-white/95">{selectedDateLabel}</p>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={selectedDateOffset >= 0}
              className="px-3 py-1 rounded-lg bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/25 text-sm"
            >
              后一天
            </button>
          </div>

          <div className="flex items-start justify-start gap-3">
            <div className="flex-1">
              <div className="bg-white/10 rounded-2xl px-5 py-3 inline-block min-w-[260px]">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="text-xs text-white/60">🧾 总兑换</p>
                    <p className="text-lg font-bold font-mono">{data.totals.totalSpent}</p>
                  </div>
                  <div className="text-right flex-1">
                    <p className="text-xs text-white/60">🏆 总得分</p>
                    <p className="text-lg font-bold font-mono">{data.totals.totalEarned}</p>
                  </div>
                </div>
                <div className="mt-2 pt-1.5 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-xs text-white/60">💸 今日兑换</p>
                      <p className="text-lg font-semibold font-mono">{data.selectedDay.spent}</p>
                    </div>
                    <div className="text-right flex-1">
                      <p className="text-xs text-white/60">🌟 今日得分</p>
                      <p className="text-lg font-semibold font-mono">{data.selectedDay.earned}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center flex-shrink-0 z-10">
              <p className="text-xs text-white/80">当前可用积分</p>
              <span className="text-6xl leading-none font-black tracking-tight font-mono">{data.totals.totalNet}</span>
              <p className="text-xs text-white/80">
                今日净变化：{data.selectedDay.net >= 0 ? "+" : ""}
                {data.selectedDay.net}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 overflow-hidden relative flex flex-col">
        <div className="flex px-4 pt-3 pb-1 gap-2 max-w-5xl mx-auto w-full">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 rounded-xl font-bold transition-all duration-200 ${
                  active ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-500 border-2 border-gray-200"
                }`}
              >
                <span className="text-xl">{tab.label === "任务" ? "✅" : "🎁"}</span>
                <span className="ml-1 text-lg">{tab.label}</span>
                {tab.key === "tasks" ? (
                  <span className={`ml-1.5 text-base font-bold px-2 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-gray-100"}`}>
                    {taskSummary}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 px-4 py-4 overflow-y-auto overflow-x-hidden pt-0 pb-6 day-scroll">
          <div className="max-w-5xl mx-auto">
            {activeTab === "tasks" ? (
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                {data.tasks.map((task, index) => (
                  <TaskTile
                    key={task.id}
                    task={task}
                    onTap={() => handleTaskTap(task)}
                    colorIndex={index}
                    disabled={!isToday || task.completed}
                    completed={task.completed}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
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
    </div>
  );
}
