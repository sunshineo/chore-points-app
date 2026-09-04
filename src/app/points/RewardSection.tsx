import Image from "next/image";

import type { PointsState } from "@/lib/points";
import { getRewardImageSrc } from "./rewardImages";

type RewardTileProps = {
  reward: PointsState["rewards"][number];
  onRedeem: () => void;
  disabled: boolean;
};

export type RewardSectionProps = {
  rewards: PointsState["rewards"];
  currentPoints: number;
  disabled: boolean;
  isUndoMode: boolean;
  onRedeem: (id: string) => void;
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

function RewardTile({ reward, onRedeem, disabled }: RewardTileProps) {
  const gradient = TILE_COLORS[Math.abs(reward.id.length) % TILE_COLORS.length];
  const imageSrc = getRewardImageSrc(reward.id);
  const isTvImage = reward.id === "reward-tv";
  const isCarTvImage = reward.id === "reward-car-tv";
  const isIpadImage = reward.id === "reward-ipad";
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
      <span
        className={`relative z-10 flex items-center justify-center text-5xl ${
          imageSrc
            ? isTvImage
              ? "h-[100px] w-[116px]"
              : isIpadImage
                ? "h-[100px] w-[100px]"
                : isCarTvImage
                  ? "h-[88px] w-[124px]"
                  : "h-[88px] w-[88px]"
            : "h-14"
        }`}
        style={{ lineHeight: 1 }}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={reward.title}
            width={88}
            height={88}
            className={
              reward.id === "reward-game"
                ? "h-14 w-14 object-contain"
                : isTvImage
                  ? "h-[100px] w-[116px] object-contain"
                  : isIpadImage
                    ? "h-[84px] w-[84px] object-contain"
                    : isCarTvImage
                      ? "h-[88px] w-[124px] object-contain"
                      : "h-[88px] w-[88px] object-contain"
            }
          />
        ) : (
          reward.emoji
        )}
      </span>
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

export function RewardSection({
  rewards,
  onRedeem,
  currentPoints,
  disabled,
  isUndoMode,
}: RewardSectionProps) {
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
