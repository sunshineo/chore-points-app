"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CelebrationOverlay,
  type Celebration,
} from "@/app/points/CelebrationOverlay";
import { PointAdjustmentDialog } from "@/app/points/PointAdjustmentDialog";
import { RewardSection } from "@/app/points/RewardSection";
import { TaskSection } from "@/app/points/TaskSection";
import { usePointsController } from "@/app/points/usePointsController";

type TabKey = "tasks" | "rewards";

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "tasks", label: "任务", emoji: "✅" },
  { key: "rewards", label: "奖励", emoji: "🎁" },
];

export default function PointsPage({ onLock }: { onLock: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [undoMode, setUndoMode] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const controller = usePointsController();
  const { data, enqueueAdjustment, enqueueReward, enqueueTask } = controller;

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 2200);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  const handleTaskCardTap = useCallback(async (taskId: string) => {
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (undoMode) setCelebration(null);
    const applied = await enqueueTask(taskId, undoMode);
    if (applied && !undoMode) {
      setCelebration({ emoji: task.emoji, value: task.defaultPoints });
    }
  }, [data, enqueueTask, undoMode]);

  const handleRewardCardTap = useCallback(async (rewardId: string) => {
    const reward = data?.rewards.find((item) => item.id === rewardId);
    if (!reward) return;
    if (undoMode) setCelebration(null);
    const applied = await enqueueReward(rewardId, undoMode);
    if (applied && !undoMode) {
      setCelebration({ emoji: reward.emoji, value: -reward.cost });
    }
  }, [data, enqueueReward, undoMode]);

  const handleManualAdjustment = useCallback(async (points: number) => {
    const applied = await enqueueAdjustment(points);
    if (applied) setCelebration({ emoji: "⭐", value: points });
    return applied;
  }, [enqueueAdjustment]);

  if (controller.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-4xl animate-pulse">⏳</div>
      </div>
    );
  }

  if (!controller.data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-sm text-red-600">
        <div>加载失败：{controller.errorMessage ?? "未知错误"}</div>
      </div>
    );
  }

  const selectedDateNet = controller.data.selectedDateNet;

  return (
    <div className="relative grid grid-rows-[auto_1fr] min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="text-white flex-shrink-0 relative overflow-hidden px-6 py-3 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
        <div className="relative z-20 flex flex-col gap-3">
          <div className="flex items-center justify-start gap-3">
            <div className="flex-1 z-10">
              <div className="flex items-center gap-4 text-7xl leading-none font-black tracking-tight">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-600 shadow-lg" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-700" />
                  <div className="absolute top-2 left-3 w-3 h-4 bg-yellow-200 rounded-full opacity-60 blur-[1px]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-yellow-900 font-bold text-lg opacity-70">★</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>{controller.displayedPoints}</span>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 z-10 flex items-center justify-end gap-2 text-right">
              <p className="text-base font-semibold text-white/95">{controller.selectedDateDateLabel}</p>
              <p className="text-base font-semibold text-white/95">{controller.selectedDateName}</p>
              <p
                className={`text-2xl font-semibold ${
                  selectedDateNet > 0
                    ? "text-emerald-300"
                    : selectedDateNet < 0
                      ? "text-rose-300"
                      : "text-white"
                }`}
              >
                {selectedDateNet > 0 ? "+" : ""}
                {selectedDateNet}
              </p>
              <button
                type="button"
                onClick={() => setUndoMode((value) => !value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                  undoMode ? "bg-rose-100 text-rose-700" : "bg-white/15 text-white"
                }`}
              >
                {undoMode ? "退出撤销" : "撤销模式"}
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentOpen(true)}
                title="临时加分或减分"
                className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-bold text-white hover:bg-white/25"
              >
                <span className="text-xl font-black leading-none" aria-hidden="true">±</span>
                <span className="ml-1.5">临时加减</span>
              </button>
              <button
                type="button"
                onClick={onLock}
                className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-bold text-white hover:bg-white/25"
                aria-label="锁定"
                title="锁定"
              >
                <span className="text-2xl leading-none" aria-hidden="true">🔒</span>
              </button>
            </div>
          </div>

          {controller.errorMessage ? (
            <div className="text-sm text-rose-100 text-center">{controller.errorMessage}</div>
          ) : null}
          {undoMode ? (
            <div className="text-xs text-white/90 mt-1">撤销模式：点击可撤销的卡片会执行撤销</div>
          ) : null}
        </div>
      </div>

      <div className="relative">
        <CelebrationOverlay celebration={celebration} />

        <div className="flex px-4 pt-3 pb-1 gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 rounded-xl font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-500 border-2 border-gray-200"
                }`}
              >
                <span style={{ fontSize: 22 }}>{tab.emoji}</span>
                <span className="ml-1 text-lg">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-6 py-4 overflow-x-hidden pt-0 pb-6">
          {activeTab === "rewards" ? (
            <RewardSection
              rewards={controller.data.rewards}
              currentPoints={controller.totalPoints}
              disabled={false}
              isUndoMode={undoMode}
              onRedeem={handleRewardCardTap}
            />
          ) : (
            <TaskSection
              tasks={controller.data.tasks}
              readOnly={false}
              isUndoMode={undoMode}
              onTap={handleTaskCardTap}
            />
          )}
        </div>
      </div>

      {adjustmentOpen ? (
        <PointAdjustmentDialog
          totalPoints={controller.totalPoints}
          onClose={() => setAdjustmentOpen(false)}
          onAdjust={handleManualAdjustment}
        />
      ) : null}
    </div>
  );
}
