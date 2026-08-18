export type KioskSection = "morning" | "evening" | "weekly";

type BonusStatus = {
  total: number;
  completed: number;
  bonusAwarded: boolean;
};

export type KioskTask = {
  id: string;
  title: string;
  emoji: string | null;
  defaultPoints: number;
  completedToday?: boolean;
  completedThisWeek?: boolean;
  weekdayOnly?: boolean;
  activeToday?: boolean;
};

export type KioskReward = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cost: number;
  stock: number | null;
};

export type KioskLearningTemplate = {
  id: string;
  title: string;
  emoji: string;
  points: number;
  note: string;
};

export type KioskEntry = {
  id: string;
  points: number;
  choreTitle: string | null;
  note: string | null;
  date: string;
};

export type KioskData = {
  kid: { id: string; name: string | null };
  totalPoints: number;
  totalEarned: number;
  chores: {
    morning: KioskTask[];
    evening: KioskTask[];
    weekly: KioskTask[];
  };
  bonuses?: {
    morning?: BonusStatus;
    evening?: BonusStatus;
    weekly?: BonusStatus;
  };
  latestEntry: KioskEntry | null;
  rewards: KioskReward[];
  learnTemplates: KioskLearningTemplate[];
  _meta: {
    lastDate: string;
    lastWeekKey: string;
    updatedAt: string;
    seedVersion: number;
  };
};

export type KioskMutationResult = {
  state: KioskData;
  changed: boolean;
  delta: number;
  emoji: string;
  reason?: string;
};

type RemoteKioskResponse = {
  kid: { id: string; name: string | null };
  totalPoints: number;
  totalEarned: number;
  chores: {
    morning: Array<Partial<KioskTask> & { id: string; title: string; defaultPoints: number }>;
    evening: Array<Partial<KioskTask> & { id: string; title: string; defaultPoints: number }>;
    weekly: Array<Partial<KioskTask> & { id: string; title: string; defaultPoints: number }>;
  };
  bonuses?: {
    morning?: BonusStatus;
    evening?: BonusStatus;
    weekly?: BonusStatus;
  };
  latestEntry: {
    id: string;
    points: number;
    choreTitle: string | null;
    note: string | null;
    date: string;
  } | null;
};

type KioskStoragePayload = {
  data: Omit<KioskData, "_meta">;
  version: number;
  savedAt: string;
};

const STORAGE_PREFIX = "kiosk-mvp-local-v1";
const STORAGE_VERSION = 1;

const DEFAULT_SEED_TASKS = {
  morning: [
    { id: "seed-morning-1", title: "洗脸刷牙", emoji: "🦷", defaultPoints: 2, weekdayOnly: true, activeToday: true },
    { id: "seed-morning-2", title: "整理床铺", emoji: "🛏️", defaultPoints: 3, weekdayOnly: false, activeToday: true },
    { id: "seed-morning-3", title: "喝一杯水", emoji: "🥤", defaultPoints: 1, weekdayOnly: false, activeToday: true },
  ],
  evening: [
    { id: "seed-evening-1", title: "收拾书包", emoji: "🎒", defaultPoints: 2, weekdayOnly: false, activeToday: true },
    { id: "seed-evening-2", title: "整理客厅", emoji: "🧹", defaultPoints: 3, weekdayOnly: false, activeToday: true },
  ],
  weekly: [
    { id: "seed-weekly-1", title: "拖地一次", emoji: "🧽", defaultPoints: 5, weekdayOnly: false, activeToday: true },
    { id: "seed-weekly-2", title: "回收桶清空", emoji: "🗑️", defaultPoints: 4, weekdayOnly: false, activeToday: true },
  ],
};

const DEFAULT_REWARDS: KioskReward[] = [
  {
    id: "reward-sweet",
    title: "选一顿喜欢的小点心",
    description: "可兑换一份小点心奖励。",
    emoji: "🍪",
    cost: 15,
    stock: null,
  },
  {
    id: "reward-playtime",
    title: "15分钟游戏时间",
    description: "完成后可额外获得放松时间。",
    emoji: "🎮",
    cost: 10,
    stock: 3,
  },
  {
    id: "reward-story",
    title: "延后洗澡时间10分钟",
    description: "延后任务 10 分钟，放松一下。",
    emoji: "🧖",
    cost: 8,
    stock: null,
  },
];

const DEFAULT_LEARNING_TEMPLATES: KioskLearningTemplate[] = [
  { id: "learn-math-5", title: "完成数学题 5 道", emoji: "🧮", points: 6, note: "做题完成" },
  { id: "learn-word-10", title: "单词复习 10 词", emoji: "📚", points: 6, note: "阅读背诵" },
  { id: "learn-quiz", title: "小测验一次", emoji: "✍️", points: 8, note: "学习打卡" },
];

function getDateKeyPT(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function getWeekKeyPT(now = new Date()): string {
  const ptNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = ptNow.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ptNow);
  monday.setDate(ptNow.getDate() + diffToMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-W${m}${d}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function storageKey(kidId: string): string {
  return `${STORAGE_PREFIX}:${kidId}`;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isInActiveTime(task: KioskTask, now = new Date()): boolean {
  if (task.weekdayOnly === false || task.weekdayOnly === undefined) return true;
  const day = now.getDay();
  return day !== 0 && day !== 6;
}

function computeBonuses(chores: KioskData["chores"]): KioskData["bonuses"] {
  const sections: KioskSection[] = ["morning", "evening", "weekly"];
  const result: KioskData["bonuses"] = {};
  for (const section of sections) {
    const items = chores[section];
    const activeItems = items.filter((item) => item.activeToday !== false);
    const total = activeItems.length;
    const completed = activeItems.filter((item) =>
      section === "weekly" ? !!item.completedThisWeek : !!item.completedToday
    ).length;
    result[section] = {
      total,
      completed,
      bonusAwarded: completed >= total && total > 0,
    };
  }
  return result;
}

function buildSeed(kidId: string, kidName: string | null): KioskData {
  const now = new Date();
  const seed: KioskData = {
    kid: { id: kidId, name: kidName },
    totalPoints: 0,
    totalEarned: 0,
    chores: {
      morning: DEFAULT_SEED_TASKS.morning.map((task) => ({
        ...task,
        completedToday: false,
        activeToday: isInActiveTime(task, now),
      })),
      evening: DEFAULT_SEED_TASKS.evening.map((task) => ({
        ...task,
        completedToday: false,
        activeToday: true,
      })),
      weekly: DEFAULT_SEED_TASKS.weekly.map((task) => ({
        ...task,
        completedThisWeek: false,
        activeToday: true,
      })),
    },
    bonuses: computeBonuses({
      morning: DEFAULT_SEED_TASKS.morning,
      evening: DEFAULT_SEED_TASKS.evening,
      weekly: DEFAULT_SEED_TASKS.weekly,
    }),
    latestEntry: null,
    rewards: clone(DEFAULT_REWARDS),
    learnTemplates: clone(DEFAULT_LEARNING_TEMPLATES),
    _meta: {
      lastDate: getDateKeyPT(now),
      lastWeekKey: getWeekKeyPT(now),
      updatedAt: nowIso(),
      seedVersion: STORAGE_VERSION,
    },
  };
  return seed;
}

function normalizeMetaFlags(state: KioskData, now = new Date()): KioskData {
  const next = clone(state);
  const today = getDateKeyPT(now);
  const weekKey = getWeekKeyPT(now);
  if (next._meta.lastDate !== today) {
    for (const key of ["morning", "evening"] as const) {
      for (const item of next.chores[key]) {
        item.completedToday = false;
        if (item.weekdayOnly) {
          item.activeToday = isInActiveTime(item, now);
        }
      }
    }
    next._meta.lastDate = today;
  }
  if (next._meta.lastWeekKey !== weekKey) {
    for (const item of next.chores.weekly) {
      item.completedThisWeek = false;
    }
    next._meta.lastWeekKey = weekKey;
  }
  next.bonuses = computeBonuses(next.chores);
  next._meta.updatedAt = nowIso();
  return next;
}

function createEntry(note: string, points: number, choreTitle: string | null): KioskEntry {
  return {
    id: nextId("entry"),
    date: nowIso(),
    points,
    choreTitle,
    note,
  };
}

function sanitizeTask(task: Partial<KioskTask> & { id: string; title: string; defaultPoints: number }): KioskTask {
  return {
    id: task.id,
    title: task.title,
    emoji: task.emoji ?? null,
    defaultPoints: task.defaultPoints,
    completedToday: task.completedToday ?? false,
    completedThisWeek: task.completedThisWeek ?? false,
    weekdayOnly: task.weekdayOnly ?? false,
    activeToday: task.activeToday ?? true,
  };
}

function readStorage(raw: string | null): Omit<KioskData, "_meta"> | null {
  if (!raw) return null;
  try {
    const parsed: KioskStoragePayload = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeStorage(payload: Omit<KioskData, "_meta">, kidId: string) {
  if (typeof window === "undefined") return;
  const wrapper: KioskStoragePayload = {
    version: STORAGE_VERSION,
    savedAt: nowIso(),
    data: payload,
  };
  localStorage.setItem(storageKey(kidId), JSON.stringify(wrapper));
}

export function ensureKioskState(kidId: string, kidName: string | null): KioskData {
  const saved = loadKioskState(kidId);
  if (saved) return normalizeMetaFlags(saved, new Date());
  const seeded = buildSeed(kidId, kidName);
  saveKioskState(seeded);
  return seeded;
}

export function loadKioskState(kidId: string): KioskData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey(kidId));
  const payload = readStorage(raw);
  if (!payload) return null;
  const state = normalizeMetaFlags({
    ...payload,
    bonuses: payload.chores ? computeBonuses(payload.chores as KioskData["chores"]) : undefined,
    _meta: {
      lastDate: getDateKeyPT(),
      lastWeekKey: getWeekKeyPT(),
      updatedAt: nowIso(),
      seedVersion: STORAGE_VERSION,
    },
    rewards: payload.rewards ?? clone(DEFAULT_REWARDS),
    learnTemplates: payload.learnTemplates ?? clone(DEFAULT_LEARNING_TEMPLATES),
  } as KioskData, new Date());
  return state;
}

export function saveKioskState(state: KioskData): void {
  if (typeof window === "undefined") return;
  const { _meta: _unusedMeta, ...rest } = state;
  writeStorage(rest, state.kid.id);
}

export function clearKioskState(kidId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(kidId));
}

export function hasKioskState(kidId: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(storageKey(kidId)));
}

export function hydrateFromRemote(kidId: string, remote: RemoteKioskResponse): KioskData {
  const existing = loadKioskState(kidId);
  const now = new Date();
  const seed = existing ?? buildSeed(kidId, remote.kid?.name ?? null);
  const next: KioskData = {
    kid: remote.kid,
    totalPoints: remote.totalPoints,
    totalEarned: remote.totalEarned ?? 0,
    chores: {
      morning: remote.chores.morning.map((item) => sanitizeTask(item)),
      evening: remote.chores.evening.map((item) => sanitizeTask(item)),
      weekly: remote.chores.weekly.map((item) => sanitizeTask(item)),
    },
    bonuses: remote.bonuses ?? computeBonuses({
      morning: remote.chores.morning.map((item) => sanitizeTask(item)),
      evening: remote.chores.evening.map((item) => sanitizeTask(item)),
      weekly: remote.chores.weekly.map((item) => sanitizeTask(item)),
    }),
    latestEntry: remote.latestEntry
      ? {
          id: remote.latestEntry.id,
          points: remote.latestEntry.points,
          choreTitle: remote.latestEntry.choreTitle,
          note: remote.latestEntry.note,
          date: remote.latestEntry.date,
        }
      : null,
    rewards: existing?.rewards ?? clone(DEFAULT_REWARDS),
    learnTemplates: existing?.learnTemplates ?? clone(DEFAULT_LEARNING_TEMPLATES),
    _meta: {
      lastDate: getDateKeyPT(now),
      lastWeekKey: getWeekKeyPT(now),
      updatedAt: nowIso(),
      seedVersion: STORAGE_VERSION,
    },
  };
  const normalized = normalizeMetaFlags(next, now);
  return normalized;
}

export function completeTask(state: KioskData, section: KioskSection, choreId: string): KioskMutationResult {
  const next = clone(state);
  const items = next.chores[section];
  const index = items.findIndex((item) => item.id === choreId);
  if (index < 0) {
    return { state, changed: false, delta: 0, emoji: "⭐", reason: "任务不存在" };
  }

  const item = items[index];
  const alreadyDone = section === "weekly" ? !!item.completedThisWeek : !!item.completedToday;
  if (alreadyDone) {
    return { state, changed: false, delta: 0, emoji: item.emoji ?? "⭐", reason: "任务已完成" };
  }

  const entryPoints = item.defaultPoints;
  if (section === "weekly") {
    item.completedThisWeek = true;
  } else {
    item.completedToday = true;
  }

  next.totalPoints += entryPoints;
  next.totalEarned += entryPoints;
  next.latestEntry = createEntry(`完成任务：${item.title}`, entryPoints, item.title);
  next._meta.updatedAt = nowIso();
  next.bonuses = computeBonuses(next.chores);
  return {
    state: next,
    changed: true,
    delta: entryPoints,
    emoji: item.emoji ?? "⭐",
  };
}

export function redeemReward(state: KioskData, rewardId: string): KioskMutationResult {
  const next = clone(state);
  const index = next.rewards.findIndex((reward) => reward.id === rewardId);
  if (index < 0) {
    return { state, changed: false, delta: 0, emoji: "🎁", reason: "奖励不存在" };
  }

  const reward = next.rewards[index];
  if (reward.stock !== null && reward.stock <= 0) {
    return { state, changed: false, delta: 0, emoji: "🎁", reason: "库存不足" };
  }
  if (next.totalPoints < reward.cost) {
    return { state, changed: false, delta: 0, emoji: "🎁", reason: "积分不足" };
  }

  next.totalPoints -= reward.cost;
  if (reward.stock !== null) {
    reward.stock = reward.stock - 1;
  }

  next.latestEntry = createEntry(`兑换奖励：${reward.title}`, -reward.cost, reward.title);
  next._meta.updatedAt = nowIso();
  return {
    state: next,
    changed: true,
    delta: -reward.cost,
    emoji: reward.emoji,
    reason: "兑换成功",
  };
}

export function completeLearningActivity(state: KioskData, activityId: string): KioskMutationResult {
  const next = clone(state);
  const activity = next.learnTemplates.find((entry) => entry.id === activityId);
  if (!activity) {
    return { state, changed: false, delta: 0, emoji: "📚", reason: "学习活动不存在" };
  }

  next.totalPoints += activity.points;
  next.totalEarned += activity.points;
  next.latestEntry = createEntry(activity.note, activity.points, "学习");
  next._meta.updatedAt = nowIso();
  return {
    state: next,
    changed: true,
    delta: activity.points,
    emoji: activity.emoji,
    reason: "记录成功",
  };
}
