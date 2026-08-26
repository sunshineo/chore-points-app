"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MANUAL_ADJUSTMENT_ITEM_ID,
  TIME_ZONE,
  type PointEvent,
  type PointsState,
  getChangedDateKeyPT,
  getDateKeyPT,
} from "@/lib/points";
import { createPointEvent } from "@/lib/point-event";
import { isPointsState } from "@/lib/points-state";
import {
  enqueuePointEvent,
  loadSnapshot,
  storeRemoteState,
} from "@/lib/offline-db";
import { drainOutbox } from "@/lib/sync-controller";

export type PointsController = {
  data: PointsState | null;
  loading: boolean;
  errorMessage: string | null;
  totalPoints: number;
  displayedPoints: number;
  todayDateKey: string;
  selectedDateDateLabel: string;
  selectedDateName: string;
  enqueueTask: (taskId: string, undo: boolean) => Promise<boolean>;
  enqueueReward: (rewardId: string, undo: boolean) => Promise<boolean>;
  enqueueAdjustment: (points: number) => Promise<boolean>;
};

type ApiErrorBody = {
  error?: string;
};

const REFRESH_INTERVAL_MS = 10_000;
const INVALID_REMOTE_ERROR = "服务器返回了无效的积分数据";

class InvalidRemoteStateError extends Error {}

function abortRemoteFetches(controllers: Set<AbortController>) {
  for (const controller of controllers) controller.abort();
  controllers.clear();
}

export function usePointsController(): PointsController {
  const [data, setData] = useState<PointsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [todayDateKey, setTodayDateKey] = useState(() => getDateKeyPT());
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);
  const selectedDateKeyRef = useRef(todayDateKey);
  const displayedPointsRef = useRef(0);
  const syncInProgressRef = useRef(false);
  const remoteRequestSequenceRef = useRef(0);
  const fetchControllersRef = useRef(new Set<AbortController>());

  selectedDateKeyRef.current = todayDateKey;

  const totalPoints = data?.totalNet ?? 0;
  const selectedDateDateLabel = useMemo(() => {
    const [, month, dateNumber] = todayDateKey.split("-").map(Number);
    return `${month}月${dateNumber}日`;
  }, [todayDateKey]);
  const selectedDateName = useMemo(
    () =>
      new Date(`${todayDateKey}T12:00:00Z`).toLocaleDateString("zh-CN", {
        timeZone: TIME_ZONE,
        weekday: "long",
      }),
    [todayDateKey],
  );

  const applyState = useCallback((state: PointsState) => {
    if (!mountedRef.current) return;
    setData(state);
    setDisplayedPoints((current) => {
      const next = current || state.totalNet;
      displayedPointsRef.current = next;
      return next;
    });
  }, []);

  const beginRemoteRequest = useCallback(() => {
    abortRemoteFetches(fetchControllersRef.current);
    return ++remoteRequestSequenceRef.current;
  }, []);

  const ownsRemoteRequest = useCallback((requestSequence: number, dateKey: string) =>
    mountedRef.current &&
    requestSequence === remoteRequestSequenceRef.current &&
    dateKey === selectedDateKeyRef.current, []);

  const fetchRemoteState = useCallback(async (dateKey: string): Promise<PointsState> => {
    const controller = new AbortController();
    fetchControllersRef.current.add(controller);
    try {
      const response = await fetch(
        `/api/points?date=${encodeURIComponent(dateKey)}`,
        { cache: "no-store", signal: controller.signal },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody;
        throw new Error(body?.error ?? `加载失败：${response.status}`);
      }

      const body: unknown = await response.json();
      if (!isPointsState(body) || body.selectedDate !== dateKey) {
        throw new InvalidRemoteStateError(INVALID_REMOTE_ERROR);
      }
      return body;
    } finally {
      fetchControllersRef.current.delete(controller);
    }
  }, []);

  const syncAndRefresh = useCallback(async () => {
    if (
      !mountedRef.current ||
      !window.navigator.onLine ||
      document.hidden ||
      syncInProgressRef.current
    ) return;

    syncInProgressRef.current = true;
    const dateKey = selectedDateKeyRef.current;
    let remoteRequestSequence: number | null = null;
    const isCurrentDate = () =>
      mountedRef.current && dateKey === selectedDateKeyRef.current;
    const ownsActiveRemoteRequest = () =>
      remoteRequestSequence !== null &&
      ownsRemoteRequest(remoteRequestSequence, dateKey);
    try {
      const result = await drainOutbox();
      if (!result.completed || !isCurrentDate()) return;
      remoteRequestSequence = beginRemoteRequest();
      const fetched = await fetchRemoteState(dateKey);
      if (!ownsActiveRemoteRequest()) return;
      const remote = await storeRemoteState(fetched);
      if (!ownsActiveRemoteRequest()) return;
      applyState(remote);
      setErrorMessage(null);
    } catch (error) {
      if (ownsActiveRemoteRequest() && error instanceof InvalidRemoteStateError) {
        setErrorMessage(INVALID_REMOTE_ERROR);
      }
    } finally {
      syncInProgressRef.current = false;
    }
  }, [applyState, beginRemoteRequest, fetchRemoteState, ownsRemoteRequest]);

  const loadState = useCallback(async (dateKey: string) => {
    const sequence = ++loadSequenceRef.current;
    let remoteRequestSequence: number | null = null;
    const isCurrentLoad = () =>
      mountedRef.current &&
      sequence === loadSequenceRef.current &&
      dateKey === selectedDateKeyRef.current;
    const ownsActiveRemoteRequest = () =>
      remoteRequestSequence !== null &&
      ownsRemoteRequest(remoteRequestSequence, dateKey);
    if (mountedRef.current) {
      setLoading(true);
      setErrorMessage(null);
    }

    let cached: PointsState | null = null;
    try {
      cached = await loadSnapshot(dateKey);
      if (!isCurrentLoad()) return;
      if (cached) {
        applyState(cached);
        setLoading(false);
      }

      if (window.navigator.onLine) {
        const result = await drainOutbox();
        if (!result.completed || !isCurrentLoad()) return;
        remoteRequestSequence = beginRemoteRequest();
        const fetched = await fetchRemoteState(dateKey);
        if (!isCurrentLoad() || !ownsActiveRemoteRequest()) return;
        const remote = await storeRemoteState(fetched);
        if (!isCurrentLoad() || !ownsActiveRemoteRequest()) return;
        applyState(remote);
        setErrorMessage(null);
      }
    } catch (error) {
      if (
        isCurrentLoad() &&
        (remoteRequestSequence === null || ownsActiveRemoteRequest())
      ) {
        if (!cached || error instanceof InvalidRemoteStateError) {
          setErrorMessage(error instanceof Error ? error.message : "加载失败");
        }
      }
    } finally {
      if (isCurrentLoad()) {
        setLoading(false);
      }
    }
  }, [applyState, beginRemoteRequest, fetchRemoteState, ownsRemoteRequest]);

  const enqueueAndApplyEvent = useCallback(async (event: PointEvent): Promise<boolean> => {
    if (!data) return false;
    try {
      const state = await enqueuePointEvent(event);
      if (!mountedRef.current) return true;
      applyState(state);
      setErrorMessage(null);
      void syncAndRefresh();
      return true;
    } catch (error) {
      if (mountedRef.current) {
        setErrorMessage(error instanceof Error ? error.message : "本地保存失败");
      }
      return false;
    }
  }, [applyState, data, syncAndRefresh]);

  const enqueueTask = useCallback(async (taskId: string, undo: boolean) => {
    const task = data?.tasks.find((item) => item.id === taskId);
    if (!task || (undo && Number(task.completedCount ?? 0) <= 0)) return false;

    return enqueueAndApplyEvent(createPointEvent({
      type: "task",
      itemId: task.id,
      points: (undo ? -1 : 1) * Math.abs(task.defaultPoints),
    }));
  }, [data, enqueueAndApplyEvent]);

  const enqueueReward = useCallback(async (rewardId: string, undo: boolean) => {
    const reward = data?.rewards.find((item) => item.id === rewardId);
    if (
      !reward ||
      (undo && reward.redeemedCount <= 0) ||
      (!undo && totalPoints < reward.cost)
    ) return false;

    return enqueueAndApplyEvent(createPointEvent({
      type: "reward",
      itemId: reward.id,
      points: (undo ? 1 : -1) * Math.abs(reward.cost),
    }));
  }, [data, enqueueAndApplyEvent, totalPoints]);

  const enqueueAdjustment = useCallback(async (points: number) => {
    if (!data) return false;
    return enqueueAndApplyEvent(createPointEvent({
      type: "adjustment",
      itemId: MANUAL_ADJUSTMENT_ITEM_ID,
      points,
    }));
  }, [data, enqueueAndApplyEvent]);

  useEffect(() => {
    mountedRef.current = true;
    const fetchControllers = fetchControllersRef.current;
    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
      remoteRequestSequenceRef.current += 1;
      abortRemoteFetches(fetchControllers);
    };
  }, []);

  useEffect(() => {
    void loadState(todayDateKey);
  }, [loadState, todayDateKey]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.hidden) return;
      const nextDateKey = getChangedDateKeyPT(todayDateKey);
      if (nextDateKey) {
        setTodayDateKey(nextDateKey);
      } else {
        void syncAndRefresh();
      }
    };

    window.addEventListener("online", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [syncAndRefresh, todayDateKey]);

  useEffect(() => {
    const start = displayedPointsRef.current;
    const end = totalPoints;
    if (start === end) return;

    const diff = end - start;
    const steps = Math.min(Math.abs(diff), 30);
    const stepDuration = 600 / steps;
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      const next = Math.round(start + diff * (step / steps));
      displayedPointsRef.current = next;
      setDisplayedPoints(next);
      if (step >= steps) window.clearInterval(interval);
    }, stepDuration);

    return () => window.clearInterval(interval);
  }, [totalPoints]);

  return {
    data,
    loading,
    errorMessage,
    totalPoints,
    displayedPoints,
    todayDateKey,
    selectedDateDateLabel,
    selectedDateName,
    enqueueTask,
    enqueueReward,
    enqueueAdjustment,
  };
}
