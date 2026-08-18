export type KioskTask = {
  id: string;
  title: string;
  emoji: string | null;
  defaultPoints: number;
  completedToday?: boolean;
  note?: string;
  kind?: "chore" | "learn";
};

export type KioskReward = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cost: number;
  stock: number | null;
};

export type KioskEntry = {
  id: string;
  points: number;
  choreTitle: string | null;
  note: string | null;
  date: string;
};

type KioskDaySummary = {
  completedTaskIds: string[];
  earned: number;
  spent: number;
};

export type KioskData = {
  kid: { id: string; name: string | null };
  totalPoints: number;
  totalEarned: number;
  totalSpent: number;
  tasks: KioskTask[];
  taskHistory: Record<string, KioskDaySummary>;
  latestEntry: KioskEntry | null;
  rewards: KioskReward[];
  _meta: {
    lastDate: string;
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
  latestEntry: {
    id: string;
    points: number;
    choreTitle: string | null;
    note: string | null;
    date: string;
  } | null;
};

type KioskStoragePayload = {
  data: {
    tasks?: KioskTask[];
    chores?: Record<string, unknown>;
    rewards?: KioskReward[];
    taskHistory?: Record<string, unknown>;
    latestEntry?: KioskEntry | null;
    totalPoints?: number;
    totalEarned?: number;
    totalSpent?: number;
    kid?: { id: string; name: string | null };
    lastDate?: string;
  };
  version: number;
  savedAt: string;
};

const STORAGE_PREFIX = "kiosk-mvp-local-v3";
const STORAGE_VERSION = 4;
const REMOVED_TASK_IDS = new Set(["seed-task-milk"]);

const DEFAULT_TASKS: KioskTask[] = [
  { id: "seed-task-morning-toilet", title: "起床后上厕所", emoji: "🚽", defaultPoints: 1, kind: "chore" },
  { id: "seed-task-face", title: "洗脸", emoji: "🚿", defaultPoints: 2, kind: "chore" },
  { id: "seed-task-clothes", title: "自己穿衣服", emoji: "👕", defaultPoints: 5, kind: "chore" },
  { id: "seed-task-breakfast", title: "把早饭吃干净", emoji: "🍽️", defaultPoints: 5, kind: "chore" },
  { id: "seed-task-shoes", title: "自己穿鞋", emoji: "👟", defaultPoints: 1, kind: "chore" },
  { id: "seed-task-bag", title: "自己装书包", emoji: "🎒", defaultPoints: 5, kind: "chore" },
  { id: "seed-task-mom-bye", title: "跟妈妈再见", emoji: "🙋", defaultPoints: 3, kind: "chore" },
  { id: "seed-task-grandma-bye", title: "跟姥姥再见", emoji: "🙋", defaultPoints: 3, kind: "chore" },
  { id: "seed-task-seatbelt", title: "自己上车自己系安全带", emoji: "🚗", defaultPoints: 2, kind: "chore" },
  { id: "seed-task-snack", title: "在学校吃光我们带的零食", emoji: "🍎", defaultPoints: 5, kind: "chore" },
  { id: "seed-task-after-school", title: "放学后进屋换鞋", emoji: "🏠", defaultPoints: 1, kind: "chore" },
  { id: "seed-task-shoe-rack", title: "把鞋放在鞋架上", emoji: "🧦", defaultPoints: 2, kind: "chore" },
  { id: "seed-task-handwash", title: "洗手", emoji: "🧼", defaultPoints: 2, kind: "chore" },
  { id: "seed-task-mom-hi", title: "跟妈妈问好", emoji: "🙋", defaultPoints: 3, kind: "chore" },
  { id: "seed-task-grandma-hi", title: "跟姥姥问好", emoji: "🙋", defaultPoints: 3, kind: "chore" },
  { id: "seed-task-dinner", title: "晚饭吃干净", emoji: "🍽️", defaultPoints: 5, kind: "chore" },
  { id: "seed-task-class", title: "上课", emoji: "📚", defaultPoints: 5, kind: "chore" },
  { id: "seed-task-math", title: "做数学题", emoji: "🧮", defaultPoints: 5, kind: "learn" },
  { id: "seed-task-handwriting", title: "写汉字", emoji: "✍️", defaultPoints: 10, kind: "learn" },
  { id: "seed-task-english", title: "拼写英文单词", emoji: "🇬🇧", defaultPoints: 5, kind: "learn" },
];

const DEFAULT_REWARDS: KioskReward[] = [
  {
    id: "reward-sweet",
    title: "甜点",
    description: "可兑换一份甜点。",
    emoji: "🍰",
    cost: 15,
    stock: null,
  },
  {
    id: "reward-tv",
    title: "15分钟看电视",
    description: "可兑换15分钟电视时间。",
    emoji: "🎮",
    cost: 15,
    stock: null,
  },
  {
    id: "reward-game",
    title: "15分钟游戏",
    description: "可兑换15分钟游戏时间。",
    emoji: "🕹️",
    cost: 15,
    stock: null,
  },
];

function getSafeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getDateKeyPT(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
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

function createEntry(note: string, points: number, choreTitle: string | null): KioskEntry {
  return {
    id: nextId("entry"),
    date: nowIso(),
    points,
    choreTitle,
    note,
  };
}

function normalizeTask(raw: Partial<KioskTask> | undefined | null): KioskTask | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const title = typeof raw.title === "string" ? raw.title : null;
  const defaultPoints = Number(raw.defaultPoints) || 0;
  if (!id || !title) return null;

  return {
    id,
    title,
    emoji: typeof raw.emoji === "string" ? raw.emoji : null,
    defaultPoints,
    completedToday: Boolean(raw.completedToday),
    note: typeof raw.note === "string" ? raw.note : undefined,
    kind: raw.kind === "learn" ? "learn" : "chore",
  };
}

function normalizeReward(raw: Partial<KioskReward> | undefined | null): KioskReward | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const title = typeof raw.title === "string" ? raw.title : null;
  const description = typeof raw.description === "string" ? raw.description : null;
  const emoji = typeof raw.emoji === "string" ? raw.emoji : null;
  if (!id || !title || !description || !emoji) return null;

  const cost = Number(raw.cost) || 0;
  const stock = raw.stock === null || Number.isFinite(Number(raw.stock)) ? (raw.stock === null ? null : Number(raw.stock)) : null;

  return {
    id,
    title,
    description,
    emoji,
    cost,
    stock,
  };
}

function normalizeDaySummary(raw: unknown): KioskDaySummary {
  if (!raw || typeof raw !== "object") {
    return { completedTaskIds: [], earned: 0, spent: 0 };
  }

  const candidate = raw as Partial<KioskDaySummary> & { points?: unknown };
  const completedTaskIds = Array.isArray(candidate.completedTaskIds)
    ? candidate.completedTaskIds.filter((value): value is string => typeof value === "string")
    : [];
  const earned = Number(candidate.earned ?? candidate.points ?? 0);
  const spent = Number(candidate.spent ?? 0);

  return {
    completedTaskIds,
    earned: Number.isFinite(earned) ? earned : 0,
    spent: Number.isFinite(spent) ? spent : 0,
  };
}

function coerceTaskHistory(raw: unknown): Record<string, KioskDaySummary> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const entries = raw as Record<string, unknown>;
  const history: Record<string, KioskDaySummary> = {};
  for (const [date, value] of Object.entries(entries)) {
    if (typeof date !== "string") continue;
    history[date] = normalizeDaySummary(value);
  }

  return history;
}

function coerceTasksFromPayload(payload: KioskStoragePayload | null): KioskTask[] | null {
  if (!payload?.data) return null;

  if (Array.isArray(payload.data.tasks)) {
    const mapped = payload.data.tasks.map((item) => normalizeTask(item)).filter(Boolean) as KioskTask[];
    const filtered = mapped.filter((task) => !REMOVED_TASK_IDS.has(task.id));
    if (mapped.length > 0) {
      return filtered;
    }
  }

  const chores = payload.data.chores;
  if (chores && typeof chores === "object") {
    const taskBuckets: Array<ReadonlyArray<Partial<KioskTask>>> = [
      Array.isArray((chores as Record<string, unknown>).morning)
        ? ((chores as Record<string, unknown>).morning as ReadonlyArray<Partial<KioskTask>>)
        : [],
      Array.isArray((chores as Record<string, unknown>).evening)
        ? ((chores as Record<string, unknown>).evening as ReadonlyArray<Partial<KioskTask>>)
        : [],
    ];
    const legacy = taskBuckets.flatMap((bucket) => bucket.map((item) => ({
      ...item,
      kind: "chore" as const,
    })));
    const mappedLegacy = legacy.map((item) => normalizeTask(item)).filter(Boolean) as KioskTask[];
    if (mappedLegacy.length > 0) {
      return mappedLegacy.filter((task) => !REMOVED_TASK_IDS.has(task.id));
    }
  }

  return null;
}

function coerceMeta(payload: KioskStoragePayload | null): KioskData["_meta"] | null {
  if (!payload?.data || typeof payload.data !== "object") return null;
  let candidateLastDate = getDateKeyPT();
  if (typeof (payload.data as { lastDate?: unknown }).lastDate === "string") {
    candidateLastDate = (payload.data as { lastDate?: string }).lastDate ?? getDateKeyPT();
  }

  return {
    lastDate: candidateLastDate,
    updatedAt: nowIso(),
    seedVersion: STORAGE_VERSION,
  };
}

function readStorage(raw: string | null): KioskStoragePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as KioskStoragePayload;
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

function buildSeed(kidId: string, kidName: string | null): KioskData {
  const now = new Date();
  return {
    kid: { id: kidId, name: kidName },
    totalPoints: 0,
    totalEarned: 0,
    totalSpent: 0,
    tasks: DEFAULT_TASKS.filter((task) => !REMOVED_TASK_IDS.has(task.id)).map((task) => ({
      ...clone(task),
      completedToday: false,
    })),
    taskHistory: {},
    latestEntry: null,
    rewards: clone(DEFAULT_REWARDS),
    _meta: {
      lastDate: getDateKeyPT(now),
      updatedAt: nowIso(),
      seedVersion: STORAGE_VERSION,
    },
  };
}

function normalizeMetaFlags(state: KioskData, now = new Date()): KioskData {
  const next = clone(state);
  const today = getDateKeyPT(now);

  next._meta.lastDate = today;
  next._meta.updatedAt = nowIso();

  const todaySummary = next.taskHistory[today] ?? { completedTaskIds: [], earned: 0, spent: 0 };
  const completedSet = new Set(todaySummary.completedTaskIds);

  next.tasks = next.tasks.map((task) => ({
    ...task,
    completedToday: completedSet.has(task.id),
  }));

  next.taskHistory = {
    ...next.taskHistory,
    [today]: {
      completedTaskIds: Array.from(completedSet),
      earned: Number.isFinite(Number(todaySummary.earned ?? 0)) ? Number(todaySummary.earned ?? 0) : 0,
      spent: Number.isFinite(Number(todaySummary.spent ?? 0)) ? Number(todaySummary.spent ?? 0) : 0,
    },
  };

  next.totalEarned = getSafeNumber(next.totalEarned, 0);
  next.totalEarned = Math.max(0, next.totalEarned);
  next.totalSpent = getSafeNumber(next.totalSpent, 0);
  next.totalSpent = Math.max(0, next.totalSpent);
  next.totalPoints = Math.max(0, next.totalEarned - next.totalSpent);
  return next;
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

  const tasks = coerceTasksFromPayload(payload);
  if (!tasks) return null;

  const rewards = Array.isArray(payload.data?.rewards)
    ? payload.data.rewards.map((reward) => normalizeReward(reward)).filter(Boolean) as KioskReward[]
    : null;

  const meta = coerceMeta(payload);
  if (!meta) return null;

  const taskHistory = coerceTaskHistory((payload.data as { taskHistory?: unknown })?.taskHistory);
  const loadedTotalPoints = getSafeNumber(payload.data?.totalPoints, 0);
  const loadedTotalEarned = getSafeNumber(payload.data?.totalEarned, loadedTotalPoints);
  const loadedTotalSpent = getSafeNumber(
    payload.data?.totalSpent,
    Math.max(loadedTotalEarned - loadedTotalPoints, 0),
  );

  const next: Omit<KioskData, "_meta"> = {
    kid: {
      id: typeof payload.data?.kid?.id === "string" ? payload.data.kid!.id : kidId,
      name: typeof payload.data?.kid?.name === "string" ? payload.data.kid!.name : null,
    },
    totalPoints: loadedTotalPoints,
    totalEarned: loadedTotalEarned,
    totalSpent: loadedTotalSpent,
    tasks: tasks.map((task) => ({
      ...task,
      completedToday: false,
    })),
    taskHistory,
    latestEntry: payload.data?.latestEntry ?? null,
    rewards: rewards ?? clone(DEFAULT_REWARDS),
  };

  return normalizeMetaFlags(
    {
      ...next,
      _meta: {
        ...meta,
        seedVersion: STORAGE_VERSION,
      },
    },
    new Date(),
  );
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
  const now = new Date();
  const existing = loadKioskState(kidId);
  const remoteTotalPoints = getSafeNumber(remote.totalPoints, 0);
  const remoteTotalEarned = getSafeNumber(remote.totalEarned, remoteTotalPoints);
  const remoteTotalSpent = Math.max(remoteTotalEarned - remoteTotalPoints, 0);
  const remoteTasks: KioskTask[] = [
    ...remote.chores.morning.map((item) =>
      normalizeTask({
        ...item,
        kind: "chore" as const,
      }),
    ),
    ...remote.chores.evening.map((item) =>
      normalizeTask({
        ...item,
        kind: "chore" as const,
      }),
    ),
  ]
    .filter(Boolean)
    .map((task) => task as KioskTask);

  const seed = buildSeed(kidId, remote.kid?.name ?? null);

  return normalizeMetaFlags(
    {
      kid: remote.kid,
      totalPoints: remoteTotalPoints,
      totalEarned: remoteTotalEarned,
      totalSpent: remoteTotalSpent,
      tasks: remoteTasks.length > 0 ? remoteTasks : existing?.tasks ?? seed.tasks,
      taskHistory: existing?.taskHistory ?? {},
      latestEntry: remote.latestEntry
        ? {
            id: remote.latestEntry.id,
            points: remote.latestEntry.points,
            choreTitle: remote.latestEntry.choreTitle,
            note: remote.latestEntry.note,
            date: remote.latestEntry.date,
          }
        : existing?.latestEntry ?? null,
      rewards: existing?.rewards ?? clone(DEFAULT_REWARDS),
      _meta: {
        lastDate: getDateKeyPT(now),
        updatedAt: nowIso(),
        seedVersion: STORAGE_VERSION,
      },
    },
    now,
  );
}

export function getTasksForDate(state: KioskData, dateKey: string): KioskTask[] {
  const daySummary = state.taskHistory[dateKey];
  if (!daySummary || daySummary.completedTaskIds.length === 0) {
    return state.tasks.map((task) => ({
      ...task,
      completedToday: false,
    }));
  }

  const completedSet = new Set(daySummary.completedTaskIds);
  return state.tasks.map((task) => ({
    ...task,
    completedToday: completedSet.has(task.id),
  }));
}

export function getDayEarnedPoints(state: KioskData, dateKey: string): number {
  return Number(state.taskHistory[dateKey]?.earned ?? 0);
}

export function getDaySpentPoints(state: KioskData, dateKey: string): number {
  return Number(state.taskHistory[dateKey]?.spent ?? 0);
}

export function getDayNetPoints(state: KioskData, dateKey: string): number {
  return getDayEarnedPoints(state, dateKey) - getDaySpentPoints(state, dateKey);
}

export function getTotalNetPoints(state: KioskData): number {
  return Math.max(0, getSafeNumber(state.totalEarned, 0) - getSafeNumber(state.totalSpent, 0));
}

export function getDayPoints(state: KioskData, dateKey: string): number {
  return getDayEarnedPoints(state, dateKey);
}

function recordTaskForDay(
  state: KioskData,
  dateKey: string,
  task: KioskTask,
  points: number,
): KioskData {
  const previousSummary = state.taskHistory[dateKey] ?? { completedTaskIds: [], earned: 0, spent: 0 };
  const nextSummary = {
    ...previousSummary,
    completedTaskIds: [...previousSummary.completedTaskIds],
    earned: Number.isFinite(Number(previousSummary.earned ?? 0)) ? Number(previousSummary.earned ?? 0) : 0,
    spent: Number.isFinite(Number(previousSummary.spent ?? 0)) ? Number(previousSummary.spent ?? 0) : 0,
  };

  if (!nextSummary.completedTaskIds.includes(task.id)) {
    nextSummary.completedTaskIds.push(task.id);
    nextSummary.earned += points;
  }

  return {
    ...state,
    taskHistory: {
      ...state.taskHistory,
      [dateKey]: {
        completedTaskIds: nextSummary.completedTaskIds,
        earned: nextSummary.earned,
        spent: nextSummary.spent,
      },
    },
  };
}

function recordSpentForDay(
  state: KioskData,
  dateKey: string,
  spentPoints: number,
): KioskData {
  const previousSummary = state.taskHistory[dateKey] ?? { completedTaskIds: [], earned: 0, spent: 0 };

  const nextSummary = {
    ...previousSummary,
    completedTaskIds: [...previousSummary.completedTaskIds],
    earned: Number.isFinite(Number(previousSummary.earned ?? 0)) ? Number(previousSummary.earned ?? 0) : 0,
    spent: (Number.isFinite(Number(previousSummary.spent ?? 0)) ? Number(previousSummary.spent ?? 0) : 0) + spentPoints,
  };

  return {
    ...state,
    taskHistory: {
      ...state.taskHistory,
      [dateKey]: {
        completedTaskIds: nextSummary.completedTaskIds,
        earned: nextSummary.earned,
        spent: nextSummary.spent,
      },
    },
  };
}

export function completeTask(state: KioskData, taskId: string): KioskMutationResult {
  const next = clone(state);
  const index = next.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) {
    return { state, changed: false, delta: 0, emoji: "⭐", reason: "任务不存在" };
  }

  const task = next.tasks[index];
  const today = getDateKeyPT();
  const todaySummary = next.taskHistory[today] ?? { completedTaskIds: [], earned: 0, spent: 0 };
  if (todaySummary.completedTaskIds.includes(taskId)) {
    return { state, changed: false, delta: 0, emoji: task.emoji ?? "⭐", reason: "任务已完成" };
  }

  const entryPoints = task.defaultPoints;
  next.tasks = next.tasks.map((currentTask) =>
    currentTask.id === taskId
      ? { ...currentTask, completedToday: true }
      : currentTask,
  );

  next.totalEarned += entryPoints;
  const afterTask = recordTaskForDay(next, today, task, entryPoints);
  afterTask.totalPoints = Math.max(0, afterTask.totalEarned - afterTask.totalSpent);
  afterTask.latestEntry = createEntry(task.kind === "learn" ? `学习：${task.title}` : `完成任务：${task.title}`, entryPoints, task.title);
  afterTask._meta.updatedAt = nowIso();

  return {
    state: afterTask,
    changed: true,
    delta: entryPoints,
    emoji: task.emoji ?? "⭐",
  };
}

export function completeLearningActivity(state: KioskData, activityId: string): KioskMutationResult {
  return completeTask(state, activityId);
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
  const availablePoints = Math.max(0, next.totalEarned - next.totalSpent);
  if (availablePoints < reward.cost) {
    return { state, changed: false, delta: 0, emoji: "🎁", reason: "积分不足" };
  }

  next.totalSpent += reward.cost;
  next.totalPoints = Math.max(0, next.totalEarned - next.totalSpent);
  if (reward.stock !== null) {
    reward.stock = reward.stock - 1;
  }

  const today = getDateKeyPT();
  let afterReward = recordSpentForDay(next, today, reward.cost);
  afterReward.latestEntry = createEntry(`兑换奖励：${reward.title}`, -reward.cost, reward.title);
  afterReward._meta.updatedAt = nowIso();

  return {
    state: afterReward,
    changed: true,
    delta: -reward.cost,
    emoji: reward.emoji,
    reason: "兑换成功",
  };
}
