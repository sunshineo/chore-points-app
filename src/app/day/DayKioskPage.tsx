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
  enough: boolean;
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
  const statusText = disabled ? "待完成" : "点我完成";
  const gradient = TILE_COLORS[colorIndex % TILE_COLORS.length];
  const emoji = getChoreEmoji(task);

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
          disabled ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        }`}
      >
        {task.completed ? "✓" : "!"}
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
      <span className="relative z-10 mt-1 text-[11px] text-white/90">{statusText}</span>
    </button>
  );
}

function RewardTile({ reward, onRedeem, disabled, enough }: RewardTileProps) {
  const gradient = TILE_COLORS[Math.abs(reward.id.length) % TILE_COLORS.length];

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
        {reward.stock === null ? "∞" : reward.stock}
      </div>

      <span className="relative z-10 text-5xl" style={{ lineHeight: 1 }}>{reward.emoji}</span>
      <h3
        className="relative z-10 mt-2 font-bold text-sm leading-tight text-center px-2 text-white"
        style={{ maxWidth: 150, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      >
        {reward.title}
      </h3>
      <p className="relative z-10 mt-1 text-[11px] text-white/80 px-2 text-center opacity-90">{reward.description}</p>
      <span
        className={`relative z-10 mt-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
          disabled ? "bg-white/20" : "bg-white/35"
        }`}
      >
        -{reward.cost} 分
      </span>
      {!enough ? <span className="relative z-10 mt-1 text-[11px] text-white/80">积分不足</span> : null}
      <span className="relative z-10 mt-2 text-sm font-bold">兑换</span>
    </button>
  );
}

function TaskSection({ tasks, onTap, readOnly }: { tasks: DayTask[]; onTap: (id: string) => void; readOnly: boolean }) {
  if (tasks.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-lg">这组还没有任务</div>;
  }

  const pending = tasks.filter((item) => !item.completed);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 px-1">
        {readOnly ? "历史日期只读查看" : pending.length === 0 ? "今天任务已完成" : `今天还有 ${pending.length} 项未完成`}
      </div>
      <div className="flex flex-wrap gap-3">
        {tasks.map((task, i) => (
          <ChoreTile
            key={task.id}
            task={task}
            colorIndex={i}
            disabled={readOnly || task.completed}
            onTap={() => onTap(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RewardSection({ rewards, onRedeem, currentPoints }: { rewards: KioskApiResponse["rewards"]; onRedeem: (id: string) => void; currentPoints: number }) {
  if (rewards.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-lg">暂无奖励配置</div>;
  }

  return (
    <div className="overflow-y-auto h-full pr-1">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {rewards.map((reward, i) => {
          const canUse = reward.stock === null ? true : reward.stock > 0;
          const enough = currentPoints >= reward.cost;
          const disabled = !canUse || !enough;
          return (
            <RewardTile
              key={reward.id + i}
              reward={reward}
              disabled={disabled}
              enough={enough}
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [celebEmoji, setCelebEmoji] = useState("⭐");
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

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
  const selectedDayEarned = data?.selectedDay.earned ?? 0;
  const selectedDaySpent = data?.selectedDay.spent ?? 0;
  const selectedDayNet = data?.selectedDay.net ?? 0;
  const totalEarned = data?.totals.totalEarned ?? 0;
  const totalSpent = data?.totals.totalSpent ?? 0;
  const totalNetPoints = data?.totals.totalNet ?? 0;

  const isToday = selectedDateOffset === 0;

  const loadState = useCallback(async () => {
    setLoading(true);
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

      setData(normalized);
      setTotalPoints(normalized.totals.totalNet);
      setDisplayedPoints((prev) => prev || normalized.totals.totalNet);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [kidId, token, selectedDateKey]);

  const syncEvents = useCallback(
    async (events: DaySyncEvent[]) => {
      if (events.length === 0) return;
      setSaving(true);

      try {
        const response = await fetch(`/api/day/sync/${encodeURIComponent(kidId)}?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
        });

        const result = (await response.json().catch(() => null)) as {
          failed?: string[];
          failedEvents?: string[];
          skipped?: number;
          applied?: number;
          totalNet?: number;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result?.error || `同步失败：${response.status}`);
        }

        if ((result?.failed?.length ?? 0) > 0 || (result?.failedEvents?.length ?? 0) > 0) {
          throw new Error("积分不足，无法完成兑换");
        }

        return result;
      } finally {
        setSaving(false);
      }
    },
    [kidId, token],
  );

  const runCelebration = useCallback((entryEmoji: string, nextTotal: number) => {
    setCelebEmoji(entryEmoji);
    setShowEmoji(true);
    setShowRain(false);

    setTimeout(() => {
      setShowEmoji(false);
      setShowRain(true);
      setTotalPoints(nextTotal);
      setTimeout(() => setShowRain(false), 2500);
    }, 3500);
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

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
    async (task: DayTask) => {
      if (!data || !isToday || task.completed || saving) return;

      const prevNet = Number(totalNetPoints);
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setErrorMessage(null);

      try {
        const result = await syncEvents([
          {
            id: eventId,
            type: "task",
            itemId: task.id,
            points: task.defaultPoints,
            dateKey: selectedDateKey,
            date: new Date().toISOString(),
            note: `完成任务：${task.title} [day-task:${task.id}][day-date:${selectedDateKey}][day-event:${eventId}]`,
          },
        ]);

        if (result?.totalNet !== undefined && result.totalNet > prevNet) {
          runCelebration(task.emoji, result.totalNet);
        }

        await loadState();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "操作失败");
      }
    },
    [data, isToday, saving, selectedDateKey, totalNetPoints, syncEvents, runCelebration, loadState],
  );

  const handleRewardRedeem = useCallback(
    async (reward: KioskApiResponse["rewards"][number]) => {
      if (!data || saving) return;
      if (reward.stock !== null && reward.stock <= 0) return;
      if (totalNetPoints < reward.cost) return;

      setErrorMessage(null);
      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        const result = await syncEvents([
          {
            id: eventId,
            type: "reward",
            itemId: reward.id,
            points: -Math.abs(reward.cost),
            dateKey: selectedDateKey,
            date: new Date().toISOString(),
            note: `兑换奖励：${reward.title} [day-reward:${reward.id}][day-date:${selectedDateKey}][day-event:${eventId}]`,
          },
        ]);

        if (result?.totalNet !== undefined) {
          setTotalPoints(result.totalNet);
        }

        await loadState();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "操作失败");
      }
    },
    [data, saving, totalNetPoints, selectedDateKey, syncEvents, loadState],
  );

  const handlePrevDay = useCallback(() => {
    setSelectedDateOffset((offset) => offset - 1);
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDateOffset((offset) => Math.min(offset + 1, 0));
  }, []);

  const taskSummary = useMemo(() => {
    const countTotal = selectedDateTasks.length;
    const countDone = selectedDateTasks.filter((item) => item.completed).length;
    return { countTotal, countDone };
  }, [selectedDateTasks]);

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
        className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
      >
        <div className="text-white flex-shrink-0 relative overflow-hidden px-6 py-3 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
          <div className="relative z-20 flex flex-col gap-3">
            {showRain && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 14 }).map((_, i) => (
                  <RainParticle key={i} emoji={celebEmoji} />
                ))}
              </div>
            )}

            <div className="flex items-start justify-start gap-3">
              <div className="flex-1 z-10">
                <p className="text-sm text-white/85 flex items-center gap-2">
                  余额
                  <span className="text-yellow-300 text-lg">🪙</span>
                </p>
                <div
                  className={`text-8xl leading-none font-black font-mono tracking-tight mt-1 ${
                    showRain ? "kiosk-counter-bump" : ""
                  }`}
                >
                  {displayedPoints}
                </div>
                <p
                  className={`mt-1 text-base font-semibold ${
                    selectedDayNet > 0
                      ? "text-emerald-300"
                      : selectedDayNet < 0
                        ? "text-rose-300"
                        : "text-white"
                  }`}
                >
                  今日变化：{selectedDayNet > 0 ? "+" : ""}
                  {selectedDayNet}
                </p>
              </div>

              <div className="flex-shrink-0 z-10 flex flex-col items-end text-right gap-1">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-sm"
                >
                  前一天
                </button>
                <p className="text-sm font-semibold text-white/95">{selectedDateDateLabel}</p>
                <p className="text-sm font-semibold text-white/95">{selectedWeekdayLabel}</p>
                <button
                  type="button"
                  onClick={handleNextDay}
                  disabled={selectedDateOffset >= 0}
                  className="px-3 py-1 rounded-lg bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/25 text-sm"
                >
                  后一天
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="text-sm text-rose-100 text-center">{errorMessage}</div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-hidden relative flex flex-col">
          {showEmoji && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)" }}
            >
              <div className="kiosk-emoji-bounce" style={{ fontSize: 160, lineHeight: 1 }}>
                {celebEmoji}
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
                  {tab.key === "tasks" && taskSummary.countTotal > 0 ? (
                    <span className={`ml-1.5 text-base font-bold px-2 py-0.5 rounded-full ${
                      isActive ? "bg-white/20" : "bg-gray-100"
                    }`}>
                      {taskSummary.countDone}/{taskSummary.countTotal}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 px-6 py-4 overflow-y-auto overflow-x-hidden pt-0 pb-6 kiosk-scroll">
            {activeTab === "rewards" ? (
              <RewardSection
                rewards={data.rewards}
                currentPoints={totalNetPoints}
                onRedeem={(rewardId) => {
                  const reward = data.rewards.find((item) => item.id === rewardId);
                  if (!reward) return;
                  void handleRewardRedeem(reward);
                }}
              />
            ) : (
              <TaskSection
                tasks={selectedDateTasks}
                onTap={(taskId) => {
                  const task = data.tasks.find((item) => item.id === taskId);
                  if (!task) return;
                  void handleTaskTap(task);
                }}
                readOnly={!isToday}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
