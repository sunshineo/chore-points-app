import Image from "next/image";
import { PointCard, POINT_CARD_GRADIENTS } from "@/app/points/PointCard";
import { getTaskImageSrc } from "@/app/points/taskImages";
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

function ChoreTile({ task, onTap, colorIndex, disabled }: ChoreTileProps) {
  const gradient = POINT_CARD_GRADIENTS[colorIndex % POINT_CARD_GRADIENTS.length];
  const completedCount = task.completedCount;
  const imageSrc = getTaskImageSrc(task.id);

  return (
    <PointCard gradient={gradient} disabled={disabled} onClick={onTap}>
      <div
        className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shadow ${
          completedCount > 0 ? "bg-emerald-500 text-white" : "bg-gray-500 text-white"
        }`}
      >
        {completedCount}
      </div>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="relative z-10 h-14 w-14 object-contain"
        />
      ) : (
        <span className="relative z-10 text-5xl" style={{ lineHeight: 1 }}>
          {task.emoji}
        </span>
      )}
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
    </PointCard>
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
