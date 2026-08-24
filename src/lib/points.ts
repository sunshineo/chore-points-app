export const TIME_ZONE = "America/Los_Angeles";

export type Task = {
  id: string;
  title: string;
  emoji: string;
  defaultPoints: number;
};

export type Reward = {
  id: string;
  title: string;
  emoji: string;
  cost: number;
};

export type TaskProgress = Task & {
  completedCount: number;
};

type RewardProgress = Reward & {
  redeemedCount: number;
};

export type PointsState = {
  totalNet: number;
  selectedDate: string;
  selectedDateNet: number;
  tasks: TaskProgress[];
  rewards: RewardProgress[];
};

export type PointEvent = {
  id: string;
  type: "task" | "reward" | "adjustment";
  itemId: string;
  points: number;
  dateKey: string;
  date: string;
};

export const MANUAL_ADJUSTMENT_ITEM_ID = "manual-adjustment";
export const MAX_MANUAL_ADJUSTMENT_POINTS = 100;

export function isValidManualAdjustmentPoints(points: unknown): points is number {
  return (
    typeof points === "number" &&
    Number.isInteger(points) &&
    points !== 0 &&
    Math.abs(points) <= MAX_MANUAL_ADJUSTMENT_POINTS
  );
}

export function getDateKeyPT(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getChangedDateKeyPT(previousDateKey: string, now = new Date()): string | null {
  const currentDateKey = getDateKeyPT(now);
  return currentDateKey === previousDateKey ? null : currentDateKey;
}

export const DEFAULT_TASKS: Task[] = [
  { id: "seed-task-morning-toilet", title: "起床后上厕所", emoji: "🚽", defaultPoints: 1 },
  { id: "seed-task-face", title: "洗脸", emoji: "🚿", defaultPoints: 1 },
  { id: "seed-task-brush", title: "刷牙", emoji: "🪥", defaultPoints: 3 },
  { id: "seed-task-clothes", title: "自己穿衣服", emoji: "👕", defaultPoints: 2 },
  { id: "seed-task-breakfast", title: "把早饭吃干净", emoji: "🍽️", defaultPoints: 2 },
  { id: "seed-task-shoes", title: "自己穿鞋", emoji: "👟", defaultPoints: 1 },
  { id: "seed-task-backpack", title: "自己背书包", emoji: "🎒", defaultPoints: 1 },
  { id: "seed-task-mom-bye", title: "跟妈妈再见", emoji: "🙋", defaultPoints: 1 },
  { id: "seed-task-grandma-bye", title: "跟姥姥再见", emoji: "🙋", defaultPoints: 1 },
  { id: "seed-task-seatbelt", title: "自己上车系安全带", emoji: "🚗", defaultPoints: 1 },
  { id: "seed-task-snack", title: "在学校吃完零食", emoji: "🥡", defaultPoints: 2 },
  { id: "seed-task-after-school", title: "放学后进屋换鞋", emoji: "🩴", defaultPoints: 1 },
  { id: "seed-task-handwash", title: "洗手", emoji: "🧼", defaultPoints: 1 },
  { id: "seed-task-grandma-hi", title: "跟姥姥问好", emoji: "🙋", defaultPoints: 1 },
  { id: "seed-task-mom-hi", title: "跟妈妈问好", emoji: "🙋", defaultPoints: 1 },
  { id: "seed-task-dinner", title: "晚饭吃干净", emoji: "🍽️", defaultPoints: 2 },
  { id: "seed-task-dinner-fruit", title: "晚饭后吃水果", emoji: "🍎", defaultPoints: 1 },
  { id: "seed-task-floss", title: "用牙线", emoji: "🦷", defaultPoints: 2 },
  { id: "seed-task-evening-toilet", title: "上厕所", emoji: "🚽", defaultPoints: 1 },
  { id: "seed-task-evening-brush", title: "晚上刷牙", emoji: "🪥", defaultPoints: 1 },
  { id: "seed-task-rinse", title: "用漱口水", emoji: "🧴", defaultPoints: 1 },
  { id: "seed-task-pyjamas", title: "自己换睡衣", emoji: "🩳", defaultPoints: 1 },
  { id: "seed-task-sleep-alone", title: "自己睡觉", emoji: "😴", defaultPoints: 2 },
  { id: "seed-task-bedtime", title: "准时上床睡觉", emoji: "🛌", defaultPoints: 3 },
  { id: "seed-task-practice-piano", title: "练钢琴", emoji: "🎹", defaultPoints: 5 },
  { id: "seed-task-math", title: "做数学题", emoji: "🧮", defaultPoints: 5 },
  { id: "seed-task-handwriting", title: "写汉字", emoji: "✍️", defaultPoints: 5 },
  { id: "seed-task-english", title: "拼写英文单词", emoji: "🔤", defaultPoints: 5 },
  { id: "seed-task-piano", title: "上钢琴课", emoji: "🎹", defaultPoints: 10 },
  { id: "seed-task-swim", title: "上游泳课", emoji: "🏊", defaultPoints: 10 },
];

export const DEFAULT_REWARDS: Reward[] = [
  {
    id: "reward-ice-stick",
    title: "冰棍或棒棒糖",
    emoji: "🍭",
    cost: 5,
  },
  {
    id: "reward-ice-cream",
    title: "冰淇淋",
    emoji: "🍦",
    cost: 10,
  },
  {
    id: "reward-sweet",
    title: "甜点",
    emoji: "🍰",
    cost: 15,
  },
  {
    id: "reward-tv",
    title: "15分钟看电视",
    emoji: "📺",
    cost: 15,
  },
  {
    id: "reward-car-tv",
    title: "在车上看电视",
    emoji: "🚗",
    cost: 15,
  },
  {
    id: "reward-game",
    title: "15分钟游戏",
    emoji: "🎮",
    cost: 15,
  },
];
