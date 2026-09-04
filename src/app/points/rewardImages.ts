const REWARD_IMAGE_BY_ID: Record<string, string> = {
  "reward-popsicle": "/icons/reward-popsicle.png",
  "reward-tv": "/icons/reward-tv-transparent.png",
  "reward-car-tv": "/icons/reward-car-tv-3-cropped.png",
  "reward-game": "/icons/reward-switch.png",
  "reward-ipad": "/icons/reward-ipad-transparent.png",
};

export function getRewardImageSrc(rewardId: string): string | undefined {
  return REWARD_IMAGE_BY_ID[rewardId];
}
