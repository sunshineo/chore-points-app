const TASK_IMAGE_SRC_BY_ID: Readonly<Record<string, string>> = {
  "seed-task-rinse": "/icons/mouthwash.png",
};

export function getTaskImageSrc(taskId: string): string | undefined {
  return TASK_IMAGE_SRC_BY_ID[taskId];
}
