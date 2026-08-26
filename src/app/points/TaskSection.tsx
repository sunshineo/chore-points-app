import type { TaskProgress } from "@/lib/points";

type ChoreTileProps = {
  task: TaskProgress;
  onTap: () => void;
  colorIndex: number;
  disabled: boolean;
};

export type TaskSectionProps = {
  tasks: TaskProgress[];
  readOnly: boolean;
  isUndoMode: boolean;
  onTap: (id: string) => void;
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

export function TaskSection({
  tasks,
  readOnly,
  onTap,
  isUndoMode,
}: TaskSectionProps) {
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
