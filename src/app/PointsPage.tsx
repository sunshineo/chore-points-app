"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MANUAL_ADJUSTMENT_ITEM_ID,
  MAX_MANUAL_ADJUSTMENT_POINTS,
  TIME_ZONE,
  type PointEvent,
  type PointsState,
  type TaskProgress,
  addDaysToDateKey,
  getChangedDateKeyPT,
  getDateKeyPT,
} from "@/lib/points";
import {
  enqueuePointEvent,
  loadSnapshot,
  storeRemoteState,
} from "@/lib/offline-db";
import { drainOutbox } from "@/lib/sync-controller";

type TabKey = "tasks" | "rewards";

type ApiErrorBody = {
  error?: string;
};

type ChoreTileProps = {
  task: TaskProgress;
  onTap: () => void;
  colorIndex: number;
  disabled: boolean;
};

type RewardTileProps = {
  reward: PointsState["rewards"][number];
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
type AdjustmentMode = "add" | "subtract";

const REFRESH_INTERVAL_MS = 10_000;
const QUICK_ADJUSTMENT_AMOUNTS = [1, 2, 3, 5, 10];

function ChoreTile({ task, onTap, colorIndex, disabled }: ChoreTileProps) {
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
}: { tasks: TaskProgress[]; onTap: (id: string) => void; readOnly: boolean; isUndoMode: boolean }) {
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
  rewards: PointsState["rewards"];
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
      className="absolute pointer-events-none app-gem-rain"
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

function PointAdjustmentDialog({
  totalPoints,
  onClose,
  onAdjust,
}: {
  totalPoints: number;
  onClose: () => void;
  onAdjust: (points: number) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<AdjustmentMode>("add");
  const [amount, setAmount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const selectMode = (nextMode: AdjustmentMode) => {
    setMode(nextMode);
    setValidationMessage(null);
  };

  const submitAdjustment = async () => {
    const parsedAmount = Number(amount);
    if (
      !Number.isInteger(parsedAmount) ||
      parsedAmount < 1 ||
      parsedAmount > MAX_MANUAL_ADJUSTMENT_POINTS
    ) {
      setValidationMessage(`请输入 1–${MAX_MANUAL_ADJUSTMENT_POINTS} 的整数`);
      return;
    }
    if (mode === "subtract" && parsedAmount > totalPoints) {
      setValidationMessage(`当前最多可减 ${totalPoints} 分`);
      return;
    }

    setSubmitting(true);
    setValidationMessage(null);
    const applied = await onAdjust(mode === "add" ? parsedAmount : -parsedAmount);
    setSubmitting(false);
    if (applied) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjustment-title"
        className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="adjustment-title" className="text-2xl font-black text-slate-900">临时加减分</h2>
            <p className="mt-1 text-sm text-slate-500">不关联任务或奖励，直接调整总积分</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500 disabled:opacity-50"
            aria-label="关闭临时加减分"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3" aria-label="选择加分或减分">
          <button
            type="button"
            onClick={() => selectMode("add")}
            className={`rounded-2xl border-2 px-4 py-3 text-lg font-black transition ${
              mode === "add"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            ＋ 加分
          </button>
          <button
            type="button"
            onClick={() => selectMode("subtract")}
            disabled={totalPoints <= 0}
            className={`rounded-2xl border-2 px-4 py-3 text-lg font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "subtract"
                ? "border-rose-500 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            − 减分
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-bold text-slate-700">分值</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MANUAL_ADJUSTMENT_POINTS}
            step={1}
            autoFocus
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setValidationMessage(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitAdjustment();
            }}
            className="mt-2 w-full rounded-2xl border-2 border-indigo-100 bg-indigo-50/60 px-4 py-3 text-center text-3xl font-black text-indigo-700 outline-none transition focus:border-indigo-400"
            aria-describedby={validationMessage ? "adjustment-error" : undefined}
          />
        </label>

        <div className="mt-3 grid grid-cols-5 gap-2" aria-label="常用分值">
          {QUICK_ADJUSTMENT_AMOUNTS.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => {
                setAmount(String(quickAmount));
                setValidationMessage(null);
              }}
              className={`rounded-xl py-2 text-sm font-bold ${
                amount === String(quickAmount)
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {quickAmount}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-6 text-center text-sm font-medium" aria-live="polite">
          {validationMessage ? <span id="adjustment-error" className="text-rose-600">{validationMessage}</span> : null}
          {!validationMessage && mode === "subtract" ? (
            <span className="text-slate-500">当前共有 {totalPoints} 分</span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void submitAdjustment()}
          disabled={submitting}
          className={`mt-2 w-full rounded-2xl py-4 text-lg font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 ${
            mode === "add"
              ? "bg-emerald-500 shadow-emerald-200"
              : "bg-rose-500 shadow-rose-200"
          }`}
        >
          {submitting ? "正在保存…" : `${mode === "add" ? "加" : "减"} ${amount || 0} 分`}
        </button>
      </section>
    </div>
  );
}

export default function PointsPage({ onLock }: { onLock: () => void }) {
  const [data, setData] = useState<PointsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [todayDateKey, setTodayDateKey] = useState(() => getDateKeyPT());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [undoMode, setUndoMode] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const loadSequenceRef = useRef(0);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInProgressRef = useRef(false);

  const selectedDateKey = useMemo(
    () => addDaysToDateKey(todayDateKey, selectedDateOffset),
    [selectedDateOffset, todayDateKey],
  );
  const selectedDateKeyRef = useRef(selectedDateKey);
  selectedDateKeyRef.current = selectedDateKey;
  const selectedDateDateLabel = useMemo(() => {
    const [, month, dateNumber] = selectedDateKey.split("-").map(Number);
    return `${month}月${dateNumber}日`;
  }, [selectedDateKey]);
  const selectedDateName = useMemo(
    () =>
      new Date(`${selectedDateKey}T12:00:00Z`).toLocaleDateString("zh-CN", {
        timeZone: TIME_ZONE,
        weekday: "long",
      }),
    [selectedDateKey],
  );
  const selectedDateNet = data?.selectedDateNet ?? 0;
  const totalNetPoints = data?.totalNet ?? 0;

  const isCurrentDate = selectedDateOffset === 0;

  const applyState = useCallback((state: PointsState) => {
    setData(state);
    setTotalPoints(state.totalNet);
    setDisplayedPoints((current) => current || state.totalNet);
  }, []);

  const fetchRemoteState = useCallback(async (): Promise<PointsState> => {
    const response = await fetch(
      `/api/points?date=${encodeURIComponent(selectedDateKey)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody;
      throw new Error(body?.error ?? `加载失败：${response.status}`);
    }

    return storeRemoteState((await response.json()) as PointsState);
  }, [selectedDateKey]);

  const syncAndRefresh = useCallback(async () => {
    if (!window.navigator.onLine || document.hidden || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    try {
      const result = await drainOutbox();
      if (!result.completed) return;
      const remote = await fetchRemoteState();
      if (remote.selectedDate === selectedDateKeyRef.current) applyState(remote);
      setErrorMessage(null);
    } catch {
      // Keep the local snapshot as-is; the next online/focus event retries.
    } finally {
      syncInProgressRef.current = false;
    }
  }, [applyState, fetchRemoteState]);

  const loadState = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setErrorMessage(null);

    let cached: PointsState | null = null;
    try {
      cached = await loadSnapshot(selectedDateKey);
      if (cached && sequence === loadSequenceRef.current) {
        applyState(cached);
        setLoading(false);
      }

      if (window.navigator.onLine) {
        const result = await drainOutbox();
        if (result.completed) {
          const remote = await fetchRemoteState();
          if (sequence === loadSequenceRef.current) applyState(remote);
        }
      }
    } catch (error) {
      if (!cached && sequence === loadSequenceRef.current) {
        setErrorMessage(error instanceof Error ? error.message : "加载失败");
      }
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [applyState, fetchRemoteState, selectedDateKey]);

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

  const enqueueAndApplyEvent = useCallback(async (event: PointEvent): Promise<boolean> => {
    if (!data) return false;
    try {
      const state = await enqueuePointEvent(event);
      applyState(state);
      setErrorMessage(null);
      void syncAndRefresh();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "本地保存失败");
      return false;
    }
  }, [applyState, data, syncAndRefresh]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const refreshTodayDate = useCallback(() => {
    const nextDateKey = getChangedDateKeyPT(todayDateKey);
    if (!nextDateKey) return false;

    setTodayDateKey(nextDateKey);
    return true;
  }, [todayDateKey]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.hidden) return;
      if (refreshTodayDate()) return;
      void syncAndRefresh();
    };

    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [refreshTodayDate, syncAndRefresh]);

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
    async (task: TaskProgress) => {
      if (!data || !isCurrentDate) return;
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: PointEvent = {
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
    [data, isCurrentDate, enqueueAndApplyEvent, runCelebration, selectedDateKey],
  );

  const handleTaskUndo = useCallback(
    async (task: TaskProgress) => {
      if (!data || !isCurrentDate) return;
      if (Number(task.completedCount ?? 0) <= 0) return;
      clearCelebration();
      const eventId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: PointEvent = {
        id: eventId,
        type: "task",
        itemId: task.id,
        points: -Math.abs(task.defaultPoints),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      await enqueueAndApplyEvent(event);
    },
    [clearCelebration, data, isCurrentDate, enqueueAndApplyEvent, selectedDateKey],
  );

  const handleRewardRedeem = useCallback(
    async (reward: PointsState["rewards"][number]) => {
      if (!data || !isCurrentDate) return;
      if (totalNetPoints < reward.cost) return;

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: PointEvent = {
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
    [data, isCurrentDate, enqueueAndApplyEvent, runCelebration, selectedDateKey, totalNetPoints],
  );

  const handleRewardUndo = useCallback(
    async (reward: PointsState["rewards"][number]) => {
      if (!data || !isCurrentDate) return;
      if (reward.redeemedCount <= 0) return;
      clearCelebration();

      const eventId = `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: PointEvent = {
        id: eventId,
        type: "reward",
        itemId: reward.id,
        points: Math.abs(reward.cost),
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      await enqueueAndApplyEvent(event);
    },
    [clearCelebration, data, isCurrentDate, enqueueAndApplyEvent, selectedDateKey],
  );

  const handleManualAdjustment = useCallback(
    async (points: number) => {
      if (!data || !isCurrentDate) return false;
      const eventId = `adjustment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const event: PointEvent = {
        id: eventId,
        type: "adjustment",
        itemId: MANUAL_ADJUSTMENT_ITEM_ID,
        points,
        dateKey: selectedDateKey,
        date: new Date().toISOString(),
      };
      const applied = await enqueueAndApplyEvent(event);
      if (applied) runCelebration("⭐", points);
      return applied;
    },
    [data, enqueueAndApplyEvent, isCurrentDate, runCelebration, selectedDateKey],
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

  const handlePreviousDate = useCallback(() => {
    setSelectedDateOffset((offset) => offset - 1);
  }, []);

  const handleNextDate = useCallback(() => {
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
        @keyframes app-gem-rain-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(500px) rotate(360deg); opacity: 0; }
        }
        @keyframes app-emoji-bounce {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.08) translateY(-12px); }
        }
        @keyframes app-celebration-fade {
          0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
          10% { opacity: 1; }
          78% { transform: translate(-50%, -52%) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, -58%) scale(1.1); opacity: 0; }
        }
        .app-gem-rain { animation: app-gem-rain-fall 2s ease-in forwards; }
        .app-emoji-bounce { animation: app-emoji-bounce 0.7s ease-in-out; }
        .app-celebration-fade { animation: app-celebration-fade 1.8s ease-out forwards; }
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
                  onClick={handlePreviousDate}
                  className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-lg"
                >
                  前一天
                </button>
                <p className="text-base font-semibold text-white/95">{selectedDateDateLabel}</p>
                <p className="text-base font-semibold text-white/95">{selectedDateName}</p>
                <p
                  className={`text-2xl font-semibold ${
                    selectedDateNet > 0
                      ? "text-emerald-300"
                      : selectedDateNet < 0
                        ? "text-rose-300"
                        : "text-white"
                  }`}
                >
                  {selectedDateNet > 0 ? "+" : ""}
                  {selectedDateNet}
                </p>
                <button
                  type="button"
                  onClick={handleNextDate}
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
                <button
                  type="button"
                  onClick={onLock}
                  className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-bold text-white hover:bg-white/25"
                >
                  🔒 锁定
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
                  <div className="app-celebration-fade absolute left-1/2 top-1/2 text-center">
                    <div className="app-emoji-bounce" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
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
                disabled={!isCurrentDate}
                isUndoMode={undoMode}
                onRedeem={handleRewardCardTap}
              />
            ) : (
              <TaskSection
                tasks={data.tasks}
                onTap={handleTaskCardTap}
                readOnly={!isCurrentDate}
                isUndoMode={undoMode}
              />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdjustmentOpen(true)}
          disabled={!isCurrentDate}
          title={isCurrentDate ? "临时加分或减分" : "只能调整今天的积分"}
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-5 z-20 flex h-16 items-center gap-2 rounded-full bg-slate-900 px-5 text-white shadow-2xl shadow-slate-500/40 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-2xl font-black" aria-hidden="true">±</span>
          <span className="text-sm font-black">临时加减</span>
        </button>

        {adjustmentOpen ? (
          <PointAdjustmentDialog
            totalPoints={totalNetPoints}
            onClose={() => setAdjustmentOpen(false)}
            onAdjust={handleManualAdjustment}
          />
        ) : null}
      </div>
    </>
  );
}
