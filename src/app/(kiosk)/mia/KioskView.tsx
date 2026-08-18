"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KioskData,
  KioskTask,
  KioskReward,
  completeTask as completeTaskMutator,
  redeemReward,
  ensureKioskState,
  saveKioskState,
  KioskMutationResult,
  getDayEarnedPoints,
  getDaySpentPoints,
  getDayNetPoints,
  getTotalNetPoints,
  getTasksForDate,
} from "@/lib/kiosk/local-kiosk-store";

const OFFLINE_LABEL = "离线模式";
const PACIFIC_TIMEZONE = "America/Los_Angeles";

type ChoreTileProps = {
  task: KioskTask;
  done: boolean;
  colorIndex: number;
  onTap: () => void;
  readOnly: boolean;
};

type RewardTileProps = {
  reward: KioskReward;
  colorIndex: number;
  onRedeem: () => void;
  canUse: boolean;
  enough: boolean;
};

type KioskDataWithReward = KioskData;

type TabKey = "tasks" | "rewards";

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

function getDateInPacific(now = new Date()): Date {
  const text = now.toLocaleString("en-US", { timeZone: PACIFIC_TIMEZONE });
  const localeDate = new Date(text);
  return new Date(localeDate.getFullYear(), localeDate.getMonth(), localeDate.getDate());
}

function getDateKeyPT(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: PACIFIC_TIMEZONE });
}

function dateLabelFromKey(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  return `${month}月${day}日`;
}

function getChoreEmoji(task: { emoji: string | null; title: string }): string {
  if (task.emoji) return task.emoji;
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const match = task.title.match(emojiRegex);
  if (match?.[0]) return match[0];
  return "⭐";
}

function ChoreTile({ task, done, colorIndex, onTap, readOnly }: ChoreTileProps) {
  const emoji = getChoreEmoji(task);
  const gradient = TILE_COLORS[colorIndex % TILE_COLORS.length];

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={done || readOnly}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-500 select-none text-white overflow-hidden bg-gradient-to-br ${gradient}`}
      style={{ width: 165, height: 165, opacity: done || readOnly ? 0.55 : 1 }}
    >
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <div
        className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${
          done ? "bg-emerald-500 text-white" : readOnly ? "bg-sky-500 text-white" : "bg-red-500 text-white"
        }`}
      >
        {readOnly ? (done ? "✓" : "锁") : done ? "✓" : "!"}
      </div>

      {task.kind === "learn" ? (
        <span className="absolute top-2 left-2 text-xs font-bold bg-white/20 px-2 py-1 rounded-full">学习</span>
      ) : null}

      <span className="relative z-10 text-5xl" style={{ lineHeight: 1 }}>{emoji}</span>
      <h3
        className="relative z-10 mt-2 font-bold text-sm leading-tight text-center px-2 text-white"
        style={{ maxWidth: 150, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      >
        {task.title}
      </h3>
      {task.note ? (
        <p className="relative z-10 mt-1 text-[11px] text-white/80 px-2 text-center opacity-90">{task.note}</p>
      ) : null}
      <span
        className={`relative z-10 mt-2 rounded-full px-4 py-1.5 text-base font-black ${
          done ? "bg-white/40" : "bg-white/30"
        }`}
      >
        +{task.defaultPoints} 分
      </span>
    </button>
  );
}

function TaskSection({ tasks, onTap, readOnly }: { tasks: KioskTask[]; onTap: (id: string) => void; readOnly: boolean }) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-lg">
        这组还没有任务
      </div>
    );
  }

  const pending = tasks.filter((item) => !item.completedToday);
  const allDone = pending.length === 0;

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 px-1">
        {readOnly ? "历史日期只读查看" : allDone ? "今天任务已完成" : `今天还有 ${pending.length} 项未完成`}
      </div>
      <div className="flex flex-wrap gap-3">
        {tasks.map((task, i) => (
          <ChoreTile
            key={task.id}
            task={task}
            done={Boolean(task.completedToday)}
            colorIndex={i}
            readOnly={readOnly}
            onTap={() => onTap(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RewardTile({ reward, colorIndex, onRedeem, canUse, enough }: RewardTileProps) {
  const disabled = !canUse || !enough;
  const gradient = TILE_COLORS[colorIndex % TILE_COLORS.length];

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
        className={`relative z-10 mt-1 rounded-full px-3 py-0.5 text-xs font-semibold ${disabled ? "bg-white/20" : "bg-white/35"}`}
      >
        -{reward.cost} 分
      </span>
      {!enough ? <span className="relative z-10 mt-1 text-[11px] text-white/80">积分不足</span> : null}
      {!canUse ? <span className="relative z-10 mt-0.5 text-[11px] text-white/80">库存不足</span> : null}
      <span className="relative z-10 mt-2 text-sm font-bold">兑换</span>
    </button>
  );
}

function RewardSection({ rewards, onRedeem, currentPoints }: { rewards: KioskReward[]; onRedeem: (id: string) => void; currentPoints: number }) {
  if (rewards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-lg">
        暂无奖励配置
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pr-1">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {rewards.map((reward, i) => {
          const canUse = reward.stock === null ? true : reward.stock > 0;
          const enough = currentPoints >= reward.cost;
          return (
            <RewardTile
              key={reward.id}
              reward={reward}
              canUse={canUse}
              enough={enough}
              colorIndex={i}
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

export default function KioskView({ kidId }: { kidId: string }) {
  const [data, setData] = useState<KioskDataWithReward | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [celebEmoji, setCelebEmoji] = useState("⭐");
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  const prevTotalRef = useRef<number | null>(null);
  const prevEntryIdRef = useRef<string | null>(null);

  const selectedDate = useMemo(() => {
    const today = getDateInPacific();
    const target = new Date(today);
    target.setDate(today.getDate() + selectedDateOffset);
    return target;
  }, [selectedDateOffset]);

  const selectedDateKey = useMemo(() => getDateKeyPT(selectedDate), [selectedDate]);
  const selectedDateLabel = useMemo(() => dateLabelFromKey(selectedDateKey), [selectedDateKey]);
  const selectedDateTasks = useMemo(() => (data ? getTasksForDate(data, selectedDateKey) : []), [data, selectedDateKey]);
  const selectedDayEarned = useMemo(() => (data ? getDayEarnedPoints(data, selectedDateKey) : 0), [data, selectedDateKey]);
  const selectedDaySpent = useMemo(() => (data ? getDaySpentPoints(data, selectedDateKey) : 0), [data, selectedDateKey]);
  const selectedDayNet = useMemo(() => (data ? getDayNetPoints(data, selectedDateKey) : 0), [data, selectedDateKey]);
  const isTodayView = selectedDateOffset === 0;

  const totalNetPoints = data ? getTotalNetPoints(data) : 0;
  const totalSpent = data?.totalSpent ?? 0;
  const totalEarned = data?.totalEarned ?? 0;

  useEffect(() => {
    const initial = ensureKioskState(kidId, "宝贝");
    const initialNet = getTotalNetPoints(initial);
    setData(initial);
    setTotalPoints(initialNet);
    setDisplayedPoints(initialNet);
    prevTotalRef.current = initialNet;
    prevEntryIdRef.current = initial.latestEntry?.id ?? null;
    setLoading(false);
  }, [kidId]);

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
    const start = displayedPoints;
    const end = totalPoints;
    if (start === end) return;

    const diff = end - start;
    const steps = Math.min(Math.abs(diff), 30);
    const stepDuration = 600 / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      setDisplayedPoints(Math.round(start + diff * progress));
      if (step >= steps) clearInterval(interval);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [totalPoints, displayedPoints]);

  const handleLocalMutation = (mutation: KioskMutationResult) => {
    if (!mutation.changed) {
      return;
    }

    saveKioskState(mutation.state);
    const previous = prevTotalRef.current;
    const incomingTotal = getTotalNetPoints(mutation.state);
    const shouldCelebrate = previous !== null && incomingTotal > previous;

    if (shouldCelebrate) {
      runCelebration(mutation.emoji, incomingTotal);
    }

    prevTotalRef.current = incomingTotal;
    prevEntryIdRef.current = mutation.state.latestEntry?.id ?? null;

    setData(mutation.state);
    setTotalPoints(incomingTotal);
    setDisplayedPoints(incomingTotal);
  };

  const handleTaskTap = (taskId: string) => {
    if (!data || !isTodayView) return;
    const mutation = completeTaskMutator(data, taskId);
    handleLocalMutation(mutation);
  };

  const handleRewardRedeem = (rewardId: string) => {
    if (!data) return;
    const mutation = redeemReward(data, rewardId);
    handleLocalMutation(mutation);
  };

  const handleGoPrevDay = () => {
    setSelectedDateOffset((offset) => offset - 1);
  };

  const handleGoNextDay = () => {
    setSelectedDateOffset((offset) => Math.min(offset + 1, 0));
  };

  const taskSummary = useMemo(() => {
    const countTotal = selectedDateTasks.length;
    const countDone = selectedDateTasks.filter((item) => item.completedToday).length;
    return { countDone, countTotal };
  }, [selectedDateTasks]);

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-4xl animate-pulse">⏳</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes kiosk-spin-slow {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
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
        .kiosk-spin-slow { animation: kiosk-spin-slow 2s linear infinite; transform-style: preserve-3d; }
        .kiosk-gem-rain { animation: kiosk-gem-rain-fall 2s ease-in forwards; }
        .kiosk-counter-bump { animation: kiosk-counter-bump 0.4s ease-out; }
        .kiosk-emoji-bounce { animation: kiosk-emoji-bounce 0.7s ease-in-out infinite; }
        .kiosk-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; }
      `}</style>

      <div
        className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
      >
        <div className="flex items-center justify-between bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white flex-shrink-0 relative overflow-hidden px-6 py-2">
          <div className="absolute top-2 left-0 right-0 z-20 flex justify-center">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleGoPrevDay}
                className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-sm"
              >
                前一天
              </button>
              <p className="text-sm font-semibold text-white/95">{selectedDateLabel}</p>
              <button
                type="button"
                onClick={handleGoNextDay}
                disabled={selectedDateOffset >= 0}
                className="px-3 py-1 rounded-lg bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/25 text-sm"
              >
                后一天
              </button>
            </div>
          </div>

          {showRain && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 14 }).map((_, i) => (
                <RainParticle key={i} emoji={celebEmoji} />
              ))}
            </div>
          )}

          <div className="flex-1 z-10">
            <div className="bg-white/10 rounded-2xl px-5 py-3 inline-block">
              <div>
                <p className="text-xs text-white/60 mb-0.5">🏆 总得分</p>
                <p className="text-2xl font-bold font-mono">{totalEarned}</p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-white/20">
                <p className="text-xs text-white/60">🌟 今天得分</p>
                <p className="text-xl font-semibold font-mono">{selectedDayEarned}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center flex-shrink-0 z-10">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 kiosk-spin-slow flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-600 shadow-lg" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-700" />
                <div className="absolute top-2 left-3 w-4 h-5 bg-yellow-200 rounded-full opacity-60 blur-[1px]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-yellow-900 font-bold text-xl opacity-70">★</span>
                </div>
              </div>
              <span className={`text-8xl font-black font-mono tracking-tight ${showRain ? "kiosk-counter-bump" : ""}`}>
                {displayedPoints}
              </span>
            </div>

            <p className="text-sm font-medium text-white/60 mt-1">总净积分（可兑换）</p>
            <p className="text-xs text-white/80 mt-1">今日净变化：{selectedDayNet >= 0 ? "+" : "-"}{Math.abs(selectedDayNet)}</p>
            <p className="text-xs text-yellow-200 mt-1">{OFFLINE_LABEL}（无需网络）</p>
          </div>

          <div className="flex-1 flex flex-col items-end justify-center z-10">
            <div className="bg-white/10 rounded-2xl px-4 py-3 inline-block text-right w-full max-w-[230px]">
              <div>
                <p className="text-xs text-white/80 mb-0.5">🧾 总兑换</p>
                <p className="text-2xl font-bold font-mono">{totalSpent}</p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-white/20">
                <p className="text-xs text-white/70">💸 今天兑换</p>
                <p className="text-xl font-semibold font-mono">{selectedDaySpent}</p>
              </div>
            </div>
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
                    <span
                      className={`ml-1.5 text-base font-bold px-2 py-0.5 rounded-full ${
                        isActive ? "bg-white/20" : "bg-gray-100"
                      }`}
                    >
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
                onRedeem={handleRewardRedeem}
              />
            ) : (
              <TaskSection
                tasks={selectedDateTasks}
                onTap={handleTaskTap}
                readOnly={!isTodayView}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
