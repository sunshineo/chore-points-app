const TASK_IMAGE_SRC_BY_ID: Readonly<Record<string, string>> = {
  "seed-task-face": "/icons/face-wash.png",
  "seed-task-floss": "/icons/floss-pick.png",
  "seed-task-rinse": "/icons/mouthwash.png",
  "seed-task-handwash": "/icons/handwash-faucet.png",
  "seed-task-seatbelt": "/icons/child-seat-harness.png",
  "seed-task-handwriting": "/icons/chinese-writing-practice.png",
  "seed-task-pyjamas": "/icons/pink-nightgown.png",
};

export function getTaskImageSrc(taskId: string): string | undefined {
  return TASK_IMAGE_SRC_BY_ID[taskId];
}
