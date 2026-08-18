export const DAY_TIMEZONE = "America/Los_Angeles";

export type DayTask = {
  id: string;
  title: string;
  emoji: string;
  defaultPoints: number;
};

export type DayReward = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  cost: number;
  stock: number | null;
  redeemedCount?: number;
};

export type DayApiTask = DayTask & {
  completed: boolean;
};

export type DayApiPayload = {
  kid: {
    id: string;
    name: string | null;
  };
  totals: {
    totalEarned: number;
    totalSpent: number;
    totalNet: number;
  };
  selectedDate: string;
  selectedDay: {
    earned: number;
    spent: number;
    net: number;
  };
  tasks: DayApiTask[];
  rewards: DayReward[];
};

export type DaySyncEvent = {
  id: string;
  type: "task" | "reward";
  itemId: string;
  points: number;
  dateKey: string;
  date: string;
  note: string;
};

export const TASK_MARKER_PREFIX = "day-task:";
export const REWARD_MARKER_PREFIX = "day-reward:";
export const DATE_MARKER_PREFIX = "day-date:";
export const EVENT_MARKER_PREFIX = "day-event:";

export function getDateInPacific(now = new Date()): Date {
  const text = now.toLocaleString("en-US", { timeZone: DAY_TIMEZONE });
  return new Date(text);
}

export function getDateKeyPT(now = new Date()): string {
  return getDateInPacific(now).toLocaleDateString("en-CA", { timeZone: DAY_TIMEZONE });
}

export function formatDateLabel(date: Date): string {
  const resolved = getDateInPacific(date);
  const month = resolved.getMonth() + 1;
  const day = resolved.getDate();
  const weekday = resolved.toLocaleDateString("zh-CN", {
    timeZone: DAY_TIMEZONE,
    weekday: "long",
  });
  return `${month}月${day}日 ${weekday}`;
}

export const DEFAULT_DAY_TASKS: DayTask[] = [
  { id: "seed-task-morning-toilet", title: "起床后上厕所", emoji: "🚽", defaultPoints: 1 },
  { id: "seed-task-face", title: "洗脸", emoji: "🚿", defaultPoints: 1 },
  { id: "seed-task-brush", title: "刷牙", emoji: "🪥", defaultPoints: 3 },
  { id: "seed-task-clothes", title: "自己穿衣服", emoji: "👕", defaultPoints: 3 },
  { id: "seed-task-breakfast", title: "把早饭吃干净", emoji: "🍽️", defaultPoints: 3 },
  { id: "seed-task-shoes", title: "自己穿鞋", emoji: "👟", defaultPoints: 1 },
  { id: "seed-task-backpack", title: "自己背书包", emoji: "🎒", defaultPoints: 1 },
  { id: "seed-task-seatbelt", title: "自己上车系安全带", emoji: "🚗", defaultPoints: 1 },
  { id: "seed-task-snack", title: "在学校吃完零食", emoji: "🍎", defaultPoints: 3 },
  { id: "seed-task-after-school", title: "放学后进屋换鞋", emoji: "🏠", defaultPoints: 1 },
  { id: "seed-task-handwash", title: "洗手", emoji: "🧼", defaultPoints: 2 },
  { id: "seed-task-grandma-bye", title: "跟姥姥问好", emoji: "🙋", defaultPoints: 3 },
  { id: "seed-task-mom-hi", title: "跟妈妈问好", emoji: "🙋", defaultPoints: 3 },
  { id: "seed-task-dinner", title: "晚饭吃干净", emoji: "🍽️", defaultPoints: 3 },
  { id: "seed-task-dinner-fruit", title: "晚饭后吃水果", emoji: "🍎", defaultPoints: 1 },
  { id: "seed-task-practice-piano", title: "练钢琴", emoji: "🎹", defaultPoints: 5 },
  { id: "seed-task-math", title: "做数学题", emoji: "🧮", defaultPoints: 5 },
  { id: "seed-task-handwriting", title: "写汉字", emoji: "✍️", defaultPoints: 5 },
  { id: "seed-task-english", title: "拼写英文单词", emoji: "🇬🇧", defaultPoints: 5 },
  { id: "seed-task-piano", title: "上钢琴课", emoji: "🎹", defaultPoints: 10 },
  { id: "seed-task-swim", title: "上游泳课", emoji: "🏊", defaultPoints: 10 },
];

export const DEFAULT_DAY_REWARDS: DayReward[] = [
  {
    id: "reward-sweet",
    title: "甜点",
    description: "可兑换15分钟甜点时间",
    emoji: "🍰",
    cost: 15,
    stock: null,
  },
  {
    id: "reward-tv",
    title: "15分钟看电视",
    description: "可兑换15分钟看电视时间",
    emoji: "📺",
    cost: 15,
    stock: null,
  },
  {
    id: "reward-car-tv",
    title: "在车上看电视",
    description: "可兑换在车上看电视15分钟",
    emoji: "🚗",
    cost: 15,
    stock: null,
  },
  {
    id: "reward-game",
    title: "15分钟游戏",
    description: "可兑换15分钟游戏时间",
    emoji: "🎮",
    cost: 15,
    stock: null,
  },
];

export function taskMarker(taskId: string): string {
  return `[${TASK_MARKER_PREFIX}${taskId}]`;
}

export function rewardMarker(rewardId: string): string {
  return `[${REWARD_MARKER_PREFIX}${rewardId}]`;
}

export function dateMarker(dateKey: string): string {
  return `[${DATE_MARKER_PREFIX}${dateKey}]`;
}

export function eventMarker(eventId: string): string {
  return `[${EVENT_MARKER_PREFIX}${eventId}]`;
}

export function parseMarker(prefix: "task" | "reward", note: string | null | undefined): string | null {
  const target = prefix === "task" ? TASK_MARKER_PREFIX : REWARD_MARKER_PREFIX;
  const match = note?.match(new RegExp(`\\[${target}([^\\]]+)\\]`));
  return match ? match[1] : null;
}

export function parseDateFromNote(note: string | null | undefined): string | null {
  const match = note?.match(/\[day-date:([^\]]+)\]/);
  return match ? match[1] : null;
}
