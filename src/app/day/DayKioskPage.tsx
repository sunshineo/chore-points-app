"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DAY_TIMEZONE,
  type DayApiPayload,
  type DayApiTask,
  type DaySyncEvent,
  getDateKeyPT,
  getDateInPacific,
} from "@/lib/day-kiosk";
import {
  enqueueDayEvent,
  loadDaySnapshot,
  storeRemoteDayPayload,
} from "@/lib/day-offline-db";
import { drainDayOutbox } from "@/lib/day-sync-controller";

type TabKey = "tasks" | "rewards";

type KioskResponseBody = {
  error?: string;
};

type KioskTileProps = {
  task: DayApiTask;
  onTap: () => void;
  colorIndex: number;
  disabled: boolean;
};

type RewardTileProps = {
  reward: DayApiPayload["rewards"][number];
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

type Celebration = { emoji: string; value: number };

const DAY_REFRESH_INTERVAL_MS = 10_000;

function ChoreTile({ task, onTap, colorIndex, disabled }: KioskTileProps) {
  const gradient = TILE_COLORS[colorIndex % TILE_COLORS.length];
  const completedCount = task.completedCount;

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
        {task.emoji}
      </span>
      <h3
        className="relative z-10 mt-2 font-bold text-sm leading-tight text-center px-2 text-white"
        style={{ maxWidth: 150, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      >
        {task.title}
      </h3>
      <span
        className={`relative z-10 mt-2 rounded-full px-4 py-1.5 text-base font-black ${
          completedCount > 0 ? "bg-white/40" : "bg-white/30"
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
}: { tasks: DayApiTask[]; onTap: (id: string) => void; readOnly: boolean; isUndoMode: boolean }) {
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
  rewards: DayApiPayload["rewards"];
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
          const enough = currentPoints >= reward.cost;
          const isDisabled = disabled || (isUndoMode ? reward.redeemedCount <= 0 : !enough);
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

function RainParticle({ emoji, index }: { emoji: string; index: number }) {
  const left = (index * 37 + 11) % 100;
  const delay = ((index * 17) % 80) / 100;
  const duration = 1.5 + ((index * 29) % 100) / 100;
  const size = 20 + ((index * 31) % 20);

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

export default function DayKioskPage() {
  const [data, setData] = useState<DayApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [undoMode, setUndoMode] = useState(false);
  const loadSequenceRef = useRef(0);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgressRef = useRef(false);

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
  const selectedDayNet = data?.selectedDayNet ?? 0;
  const totalNetPoints = data?.totalNet ?? 0;

  const isToday = selectedDateOffset === 0;

  const applyPayload = useCallback((payload: DayApiPayload) => {
    setData(payload);
    setTotalPoints(payload.totalNet);
    setDisplayedPoints((current) => current || payload.totalNet);
  }, []);

  const fetchRemoteState = useCallback(async (): Promise<DayApiPayload> => {
    const response = await fetch(
      `/api/day?date=${encodeURIComponent(selectedDateKey)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as KioskResponseBody;
      throw new Error(body?.error ?? `加载失败：${response.status}`);
    }

    return storeRemoteDayPayload((await response.json()) as DayApiPayload);
  }, [selectedDateKey]);

  const syncAndRefresh = useCallback(async () => {
    if (!window.navigator.onLine || document.hidden || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    try {
      const result = await drainDayOutbox();
      if (!result.completed) return;
      const remote = await fetchRemoteState();
      applyPayload(remote);
      setErrorMessage(null);
    } catch {
      // Keep the local snapshot as-is; the next online/focus event retries.
    } finally {
      syncInProgressRef.current = false;
    }
  }, [applyPayload, fetchRemoteState]);

  const loadState = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setErrorMessage(null);

    let cached: DayApiPayload | null = null;
    try {
      cached = await loadDaySnapshot(selectedDateKey);
      if (cached && sequence === loadSequenceRef.current) {
        applyPayload(cached);
        setLoading(false);
      }

      if (window.navigator.onLine) {
        const result = await drainDayOutbox();
        if (result.completed) {
          const remote = await fetchRemoteState();
          if (sequence === loadSequenceRef.current) applyPayload(remote);
        }
      }
    } catch (error) {
      if (!cached && sequence === loadSequenceRef.current) {
        setErrorMessage(error instanceof Error ? error.message : "加载失败");
      }
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [applyPayload, fetchRemoteState, selectedDateKey]);

  const runCelebration = useCallback((entryEmoji: string, value: number) => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
    }
    setCelebration({ emoji: entryEmoji, value });
    celebrationTimerRef.current = setTimeout(() => {
      setCelebration(null);
      celebrationTimerRef.current = null;
    }, 2200);
  }, []);

  const clearCelebration = useCallback(() => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
    setCelebration(null);
  }, []);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const enqueueAndApplyEvent = useCallback(async (event: DaySyncEvent): Promise<boolean> => {
    if (!data) return false;
    try {
      const payload = await enqueueDayEvent(event);
      applyPayload(payload);
      setErrorMessage(null);
      void syncAndRefresh();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "本地保存失败");
      return false;
    }
  }, [applyPayload, data, syncAndRefresh]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) void syncAndRefresh();
    };

    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(refreshWhenVisible, DAY_REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [syncAndRefresh]);

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
    async (task: DayApiTask) => {
      if (!data || !isToday) return;
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: DaySyncEvent = {
        id: eventId,
        type: "task",
        itemId: task.id,
        points: Math.abs(task.defaultPoints),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      if (await enqueueAndApplyEvent(event)) {
        runCelebration(task.emoji, task.defaultPoints);
      }
    },
    [data, isToday, enqueueAndApplyEvent, runCelebration, selectedDateKey],
  );

  const handleTaskUndo = useCallback(
    async (task: DayApiTask) => {
      if (!data || !isToday) return;
      if (Number(task.completedCount ?? 0) <= 0) return;
      clearCelebration();
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: DaySyncEvent = {
        id: eventId,
        type: "task",
        itemId: task.id,
        points: -Math.abs(task.defaultPoints),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      await enqueueAndApplyEvent(event);
    },
    [clearCelebration, data, isToday, enqueueAndApplyEvent, selectedDateKey],
  );

  const handleRewardRedeem = useCallback(
    async (reward: DayApiPayload["rewards"][number]) => {
      if (!data || !isToday) return;
      if (totalNetPoints < reward.cost) return;

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: DaySyncEvent = {
        id: eventId,
        type: "reward",
        itemId: reward.id,
        points: -Math.abs(reward.cost),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      if (await enqueueAndApplyEvent(event)) {
        runCelebration(reward.emoji, -reward.cost);
      }
    },
    [data, isToday, enqueueAndApplyEvent, runCelebration, selectedDateKey, totalNetPoints],
  );

  const handleRewardUndo = useCallback(
    async (reward: DayApiPayload["rewards"][number]) => {
      if (!data || !isToday) return;
      if (reward.redeemedCount <= 0) return;
      clearCelebration();

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: DaySyncEvent = {
        id: eventId,
        type: "reward",
        itemId: reward.id,
        points: Math.abs(reward.cost),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      await enqueueAndApplyEvent(event);
    },
    [clearCelebration, data, isToday, enqueueAndApplyEvent, selectedDateKey],
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
    setSelectedDateOffset((offset) => offset - 1);
  }, []);

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
        @keyframes kiosk-emoji-bounce {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.08) translateY(-12px); }
        }
        @keyframes kiosk-celebration-fade {
          0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
          10% { opacity: 1; }
          78% { transform: translate(-50%, -52%) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, -58%) scale(1.1); opacity: 0; }
        }
        .kiosk-gem-rain { animation: kiosk-gem-rain-fall 2s ease-in forwards; }
        .kiosk-emoji-bounce { animation: kiosk-emoji-bounce 0.7s ease-in-out; }
        .kiosk-celebration-fade { animation: kiosk-celebration-fade 1.8s ease-out forwards; }
      `}</style>

      <div
        className="relative grid grid-rows-[auto_1fr] min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
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
                  className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-lg"
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
              {celebration ? (
              <div
                className="fixed inset-0 z-30 pointer-events-none"
                style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)" }}
              >
                <div className="relative h-full w-full overflow-hidden">
                  <div className="absolute inset-0 overflow-hidden">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <RainParticle key={i} emoji={celebration.emoji} index={i} />
                    ))}
                  </div>
                  <div className="kiosk-celebration-fade absolute left-1/2 top-1/2 text-center">
                    <div className="kiosk-emoji-bounce" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
                      <span
                        className={`text-8xl font-black ${celebration.value >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                      >
                        {celebration.value > 0 ? "+" : ""}
                        {celebration.value}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

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
                tasks={data.tasks}
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
