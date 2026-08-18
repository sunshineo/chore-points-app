"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  KioskData,
  KioskSection,
  KioskLearningTemplate,
  KioskTask,
  KioskReward,
  completeTask as completeTaskMutator,
  completeLearningActivity as completeLearningMutator,
  redeemReward,
  ensureKioskState,
  saveKioskState,
  KioskMutationResult,
} from "@/lib/kiosk/local-kiosk-store";

const OFFLINE_LABEL = "离线模式";

type ChoreTileProps = {
  chore: {
    id: string;
    title: string;
    emoji: string | null;
    defaultPoints: number;
  };
  done: boolean;
  colorIndex: number;
  onTap: () => void;
};

type BonusStatus = {
  total: number;
  completed: number;
  bonusAwarded: boolean;
};

type KioskDataWithReward = KioskData & {
  bonuses?: {
    morning?: BonusStatus;
    evening?: BonusStatus;
    weekly?: BonusStatus;
  };
};

type ChoreSectionProps = {
  chores: KioskTask[];
  isWeekly?: boolean;
  colorOffset?: number;
  onTap: (id: string) => void;
};

type TabKey = "morning" | "evening" | "weekly" | "rewards" | "learn";

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "morning", label: "早上", emoji: "🌅" },
  { key: "evening", label: "晚上", emoji: "🌙" },
  { key: "weekly", label: "每周", emoji: "📅" },
  { key: "rewards", label: "奖励", emoji: "🎁" },
  { key: "learn", label: "学习", emoji: "🧠" },
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

function getChoreEmoji(chore: { emoji: string | null; title: string }): string {
  if (chore.emoji) return chore.emoji;
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const match = chore.title.match(emojiRegex);
  if (match?.[0]) return match[0];
  return "⭐";
}

function normalizeDate(now = new Date()): { todayFormatted: string; weekRangeFormatted: string } {
  const nowPt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const month = nowPt.getMonth() + 1;
  const date = nowPt.getDate();
  const day = nowPt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(nowPt);
  monday.setDate(nowPt.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return {
    todayFormatted: `${month}月${date}日`,
    weekRangeFormatted: `${fmt(monday)} - ${fmt(sunday)}`,
  };
}

function ChoreTile({ chore, done, colorIndex, onTap }: ChoreTileProps) {
  const emoji = getChoreEmoji(chore);
  const gradient = TILE_COLORS[colorIndex % TILE_COLORS.length];

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={done}
      className={`relative flex flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-500 select-none text-white overflow-hidden bg-gradient-to-br ${gradient}`}
      style={{ width: 165, height: 165, opacity: done ? 0.55 : 1 }}
    >
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
      <div
        className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${
          done ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        }`}
      >
        {done ? "✓" : "!"}
      </div>

      <span className="relative z-10 text-5xl" style={{ lineHeight: 1 }}>{emoji}</span>
      <h3
        className="relative z-10 mt-2 font-bold text-sm leading-tight text-center px-2 text-white"
        style={{ maxWidth: 150, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      >
        {chore.title}
      </h3>
      <span
        className={`relative z-10 mt-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
          done ? "bg-white/40" : "bg-white/30"
        }`}
      >
        +{chore.defaultPoints} 分
      </span>
    </button>
  );
}

function ChoreSection({ chores, isWeekly, colorOffset = 0, onTap }: ChoreSectionProps) {
  if (chores.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-lg">
        这组还没有任务
      </div>
    );
  }

  const active = chores.filter((item) => item.activeToday !== false);
  const done = chores.filter((item) =>
    isWeekly ? !!item.completedThisWeek : !!item.completedToday,
  );
  const pending = chores.filter((item) => {
    const doneNow = isWeekly ? !!item.completedThisWeek : !!item.completedToday;
    return !doneNow;
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 px-1">
        {active.length > 0 ? `${done.length}/${active.length} 已完成（未含今日不计入任务）` : "今天没有可做任务"}
      </div>
      <div className="flex flex-wrap gap-3">
        {pending.map((chore, i) => (
          <ChoreTile
            key={chore.id}
            chore={chore}
            done={isWeekly ? !!chore.completedThisWeek : !!chore.completedToday}
            colorIndex={colorOffset + i}
            onTap={() => onTap(chore.id)}
          />
        ))}
      </div>
      {active.length > 0 ? <div className="text-sm text-gray-500 px-1">已完成任务</div> : null}
      <div className="flex flex-wrap gap-3">
        {done.map((chore, i) => (
          <ChoreTile
            key={chore.id}
            chore={chore}
            done
            colorIndex={colorOffset + active.length + i}
            onTap={() => onTap(chore.id)}
          />
        ))}
      </div>
    </div>
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
      <div className="grid gap-3">
        {rewards.map((reward) => {
          const canUse = reward.stock === null ? true : reward.stock > 0;
          const enough = currentPoints >= reward.cost;
          return (
            <div
              key={reward.id}
              className="rounded-2xl bg-white/70 backdrop-blur-sm border border-rose-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-lg">
                    {reward.emoji} {reward.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{reward.description}</p>
                </div>
                <p className="font-bold text-sm text-indigo-700">-{reward.cost} 分</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {reward.stock === null ? "不限次" : `${reward.stock} 次可用`}
                </p>
                <button
                  onClick={() => onRedeem(reward.id)}
                  disabled={!canUse || !enough}
                  className="px-3 py-2 rounded-xl font-bold text-sm bg-indigo-600 text-white disabled:bg-gray-300 disabled:text-gray-500"
                >
                  兑换
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LearnSection({ templates, onLearn }: { templates: KioskLearningTemplate[]; onLearn: (id: string) => void }) {
  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-lg">
        暂无学习任务配置
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pr-1">
      <div className="grid gap-3">
        {templates.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-white/70 backdrop-blur-sm border border-sky-100 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="font-bold text-lg">
                {item.emoji} {item.title}
              </p>
              <p className="text-sm font-bold text-blue-700">+{item.points} 分</p>
            </div>
            <p className="text-sm text-gray-500 mt-2">{item.note}</p>
            <button
              onClick={() => onLearn(item.id)}
              className="mt-3 w-full py-2 rounded-xl text-sm font-bold bg-sky-600 text-white"
            >
              完成记录
            </button>
          </div>
        ))}
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
  const [activeTab, setActiveTab] = useState<TabKey>("morning");

  const [toast, setToast] = useState<string | null>(null);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [celebEmoji, setCelebEmoji] = useState("⭐");
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  const prevTotalRef = useRef<number | null>(null);
  const prevEntryIdRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dates = useMemo(() => normalizeDate(), []);

  useEffect(() => {
    const initial = ensureKioskState(kidId, "宝贝");
    setData(initial);
    setTotalPoints(initial.totalPoints);
    setDisplayedPoints(initial.totalPoints);
    prevTotalRef.current = initial.totalPoints;
    prevEntryIdRef.current = initial.latestEntry?.id ?? null;
    setToast("Kiosk 已进入纯离线本地模式");
    setLoading(false);
  }, [kidId]);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 1800);
  }, []);

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
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
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
      if (mutation.reason) showToast(mutation.reason);
      return;
    }

    saveKioskState(mutation.state);
    const previous = prevTotalRef.current;
    const incomingTotal = mutation.state.totalPoints;
    const incomingEntry = mutation.state.latestEntry?.id ?? null;
    const shouldCelebrate = previous !== null && incomingTotal > previous;

    if (shouldCelebrate) {
      runCelebration(mutation.emoji, incomingTotal);
    }

    prevTotalRef.current = incomingTotal;
    prevEntryIdRef.current = incomingEntry;

    setData(mutation.state);
    setTotalPoints(incomingTotal);
    setDisplayedPoints(incomingTotal);
    showToast(`${mutation.delta >= 0 ? "+" : ""}${mutation.delta} 分`);
  };

  const handleTaskTap = (section: KioskSection, choreId: string) => {
    if (!data) return;
    const mutation = completeTaskMutator(data, section, choreId);
    handleLocalMutation(mutation);
  };

  const handleRewardRedeem = (rewardId: string) => {
    if (!data) return;
    const mutation = redeemReward(data, rewardId);
    handleLocalMutation(mutation);
  };

  const handleLearning = (activityId: string) => {
    if (!data) return;
    const mutation = completeLearningMutator(data, activityId);
    handleLocalMutation(mutation);
  };

  const todayCompleted = useCallback((tab: KioskSection) => {
    const list = data?.chores?.[tab] ?? [];
    const countTotal = list.filter((item) => item.activeToday !== false).length;
    const countDone = list.filter((item) => (tab === "weekly" ? !!item.completedThisWeek : !!item.completedToday)).length;
    const bonusAwarded = (data?.bonuses?.[tab]?.bonusAwarded) ?? false;
    return {
      countDone,
      countTotal,
      bonusText: bonusAwarded ? "🌟+5" : "全勤+5",
    };
  }, [data]);

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
      `}</style>

      <div
        className="fixed inset-0 z-50 overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
      >
        <div className="flex items-center justify-between bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white flex-shrink-0 relative overflow-hidden px-6" style={{ height: "22vh" }}>
          {showRain && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 14 }).map((_, i) => (
                <RainParticle key={i} emoji={celebEmoji} />
              ))}
            </div>
          )}

          <div className="flex-1 z-10">
            {data.totalEarned > 0 && (
              <div className="bg-white/10 rounded-2xl px-5 py-3 inline-block">
                <p className="text-xs text-white/60 mb-0.5">🏆 累计得分</p>
                <p className="text-3xl font-bold font-mono">{data.totalEarned}</p>
                <p className="text-xs text-white/50">分</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center flex-shrink-0 z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-bold text-white/80">{data.kid.name ?? "宝贝"}</span>
              <span className="text-xl">✨</span>
            </div>

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

            <p className="text-sm font-medium text-white/60 mt-1">积分</p>
            <p className="text-xs text-yellow-200 mt-1">{OFFLINE_LABEL}（无需网络）</p>
          </div>

          <div className="flex-1 flex justify-end z-10">
            <div className="bg-white/10 rounded-2xl px-5 py-3 inline-block text-right">
              <p className="text-xs text-white/60 mb-0.5">📅 今天</p>
              <p className="text-lg font-semibold">{dates.todayFormatted}</p>
              <div className="mt-1.5 pt-1.5 border-t border-white/20">
                <p className="text-xs text-white/60 mb-0.5">🌟 本周</p>
                <p className="text-lg font-semibold">{dates.weekRangeFormatted}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
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

          {toast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full bg-black/80 text-white px-4 py-2 text-sm">
              {toast}
            </div>
          )}

          <div className="flex px-4 pt-3 pb-1 gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const { countDone, countTotal, bonusText } =
                tab.key === "rewards" || tab.key === "learn"
                  ? { countDone: 0, countTotal: 0, bonusText: "" }
                  : todayCompleted(tab.key);
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
                  {countTotal > 0 ? (
                    <span
                      className={`ml-1.5 text-base font-bold px-2 py-0.5 rounded-full ${
                        isActive ? "bg-white/20" : "bg-gray-100"
                      }`}
                    >
                      {countDone}/{countTotal}
                    </span>
                  ) : null}
                  {bonusText ? (
                    <span
                      className={`ml-1.5 text-base ${
                        isActive ? "text-yellow-300 font-bold" : "text-yellow-500 font-bold"
                      }`}
                    >
                      {bonusText}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex-1 px-6 py-4 overflow-y-auto">
            {activeTab === "rewards" ? (
              <RewardSection
                rewards={data.rewards}
                currentPoints={data.totalPoints}
                onRedeem={handleRewardRedeem}
              />
            ) : activeTab === "learn" ? (
              <LearnSection templates={data.learnTemplates} onLearn={handleLearning} />
            ) : (
              <ChoreSection
                chores={data.chores[activeTab]}
                isWeekly={activeTab === "weekly"}
                colorOffset={activeTab === "morning" ? 0 : activeTab === "evening" ? 3 : 6}
                onTap={(id) => handleTaskTap(activeTab, id)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
