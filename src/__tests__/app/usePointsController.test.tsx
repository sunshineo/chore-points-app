// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const offlineMocks = vi.hoisted(() => ({
  enqueuePointEvent: vi.fn(),
  loadSnapshot: vi.fn(),
  storeRemoteState: vi.fn(),
}));

const syncMocks = vi.hoisted(() => ({
  drainOutbox: vi.fn(),
}));

const dateMocks = vi.hoisted(() => ({
  getChangedDateKeyPT: vi.fn(),
}));

vi.mock("@/lib/offline-db", () => offlineMocks);
vi.mock("@/lib/sync-controller", () => syncMocks);
vi.mock("@/lib/points", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/points")>();
  return {
    ...actual,
    getChangedDateKeyPT: dateMocks.getChangedDateKeyPT,
  };
});

import { usePointsController } from "@/app/points/usePointsController";
import {
  DEFAULT_REWARDS,
  DEFAULT_TASKS,
  getDateKeyPT,
  type PointsState,
} from "@/lib/points";

const DATE_KEY = getDateKeyPT();
const NEXT_DATE_KEY = new Date(
  new Date(`${DATE_KEY}T12:00:00Z`).getTime() + 86_400_000,
).toISOString().slice(0, 10);
const INVALID_REMOTE_ERROR = "服务器返回了无效的积分数据";

function makeState({
  dateKey = DATE_KEY,
  totalNet = 10,
  selectedDateNet = totalNet,
  completedTaskId,
  redeemedRewardId,
}: {
  dateKey?: string;
  totalNet?: number;
  selectedDateNet?: number;
  completedTaskId?: string;
  redeemedRewardId?: string;
} = {}): PointsState {
  return {
    totalNet,
    selectedDate: dateKey,
    selectedDateNet,
    tasks: DEFAULT_TASKS.map((task) => ({
      ...task,
      completedCount: task.id === completedTaskId ? 1 : 0,
    })),
    rewards: DEFAULT_REWARDS.map((reward) => ({
      ...reward,
      redeemedCount: reward.id === redeemedRewardId ? 1 : 0,
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  offlineMocks.enqueuePointEvent.mockReset();
  offlineMocks.loadSnapshot.mockReset();
  offlineMocks.storeRemoteState.mockReset();
  syncMocks.drainOutbox.mockReset().mockResolvedValue({ completed: true, rejected: 0 });
  dateMocks.getChangedDateKeyPT.mockReset().mockReturnValue(null);
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePointsController lifecycle", () => {
  it("exposes the cached snapshot before replacing it with validated remote data", async () => {
    const cached = makeState({ totalNet: 4 });
    const remote = makeState({ totalNet: 9 });
    const remoteResponse = deferred<Response>();
    offlineMocks.loadSnapshot.mockResolvedValue(cached);
    offlineMocks.storeRemoteState.mockResolvedValue(remote);
    vi.stubGlobal("fetch", vi.fn(() => remoteResponse.promise));

    const { result } = renderHook(() => usePointsController());

    await waitFor(() => {
      expect(result.current.data?.totalNet).toBe(4);
      expect(result.current.loading).toBe(false);
    });

    remoteResponse.resolve(Response.json(remote));

    await waitFor(() => {
      expect(result.current.data?.totalNet).toBe(9);
      expect(result.current.errorMessage).toBeNull();
    });
  });

  it("keeps cached data and reports a stable error for missing or unknown remote tasks", async () => {
    const cached = makeState({ totalNet: 7, completedTaskId: "seed-task-face" });
    const completeRemote = makeState({ totalNet: 99 });
    const missingTasks = {
      totalNet: completeRemote.totalNet,
      selectedDate: completeRemote.selectedDate,
      selectedDateNet: completeRemote.selectedDateNet,
      rewards: completeRemote.rewards,
    };
    const unknownTask = {
      ...completeRemote,
      tasks: completeRemote.tasks.map((task, index) =>
        index === 0 ? { ...task, id: "unknown-task" } : task,
      ),
    };
    offlineMocks.loadSnapshot.mockResolvedValue(cached);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(missingTasks))
      .mockResolvedValueOnce(Response.json(unknownTask));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePointsController());

    await waitFor(() => {
      expect(result.current.data).toEqual(cached);
      expect(result.current.errorMessage).toBe(INVALID_REMOTE_ERROR);
    });

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(cached);
      expect(result.current.errorMessage).toBe(INVALID_REMOTE_ERROR);
      expect(offlineMocks.storeRemoteState).not.toHaveBeenCalled();
    });
  });

  it("rejects a structurally valid remote state for a different requested date", async () => {
    const cached = makeState({ totalNet: 7, completedTaskId: "seed-task-face" });
    const mismatchedRemote = makeState({
      dateKey: NEXT_DATE_KEY,
      totalNet: 99,
      selectedDateNet: 92,
    });
    offlineMocks.loadSnapshot.mockResolvedValue(cached);
    offlineMocks.storeRemoteState.mockResolvedValue(mismatchedRemote);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(mismatchedRemote)));

    const { result } = renderHook(() => usePointsController());

    await waitFor(() => {
      expect(result.current.data).toEqual(cached);
      expect(result.current.errorMessage).toBe(INVALID_REMOTE_ERROR);
      expect(offlineMocks.storeRemoteState).not.toHaveBeenCalled();
    });
  });

  it("optimistically exposes an offline task event without fetching remotely", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const cached = makeState({ totalNet: 10 });
    const optimistic = makeState({
      totalNet: 11,
      selectedDateNet: 11,
      completedTaskId: "seed-task-face",
    });
    offlineMocks.loadSnapshot.mockResolvedValue(cached);
    offlineMocks.enqueuePointEvent.mockResolvedValue(optimistic);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePointsController());
    await waitFor(() => expect(result.current.data?.totalNet).toBe(10));

    let applied = false;
    await act(async () => {
      applied = await result.current.enqueueTask("seed-task-face", false);
    });

    expect(applied).toBe(true);
    expect(result.current.data?.totalNet).toBe(11);
    expect(
      result.current.data?.tasks.find((task) => task.id === "seed-task-face")
        ?.completedCount,
    ).toBe(1);
    expect(offlineMocks.enqueuePointEvent).toHaveBeenCalledTimes(1);
    expect(offlineMocks.enqueuePointEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task",
        itemId: "seed-task-face",
        points: 1,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("replaces a rejected optimistic value with the authoritative remote state", async () => {
    const optimistic = makeState({
      totalNet: 11,
      selectedDateNet: 11,
      completedTaskId: "seed-task-face",
    });
    const authoritative = makeState({ totalNet: 10 });
    const remoteResponse = deferred<Response>();
    offlineMocks.loadSnapshot.mockResolvedValue(optimistic);
    syncMocks.drainOutbox.mockResolvedValue({ completed: true, rejected: 1 });
    offlineMocks.storeRemoteState.mockResolvedValue(authoritative);
    vi.stubGlobal("fetch", vi.fn(() => remoteResponse.promise));

    const { result } = renderHook(() => usePointsController());
    await waitFor(() => expect(result.current.data?.totalNet).toBe(11));

    remoteResponse.resolve(Response.json(authoritative));

    await waitFor(() => {
      expect(result.current.data?.totalNet).toBe(10);
      expect(
        result.current.data?.tasks.find((task) => task.id === "seed-task-face")
          ?.completedCount,
      ).toBe(0);
    });
  });

  it("requests the next Pacific date snapshot on the data-refresh interval", async () => {
    vi.useFakeTimers();
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const current = makeState({ totalNet: 3 });
    const next = makeState({ dateKey: NEXT_DATE_KEY, totalNet: 3, selectedDateNet: 0 });
    offlineMocks.loadSnapshot.mockImplementation(async (dateKey: string) =>
      dateKey === NEXT_DATE_KEY ? next : current,
    );

    const { result } = renderHook(() => usePointsController());
    await act(flushAsyncWork);
    expect(result.current.todayDateKey).toBe(DATE_KEY);
    expect(result.current.data?.selectedDate).toBe(DATE_KEY);

    dateMocks.getChangedDateKeyPT.mockReturnValueOnce(NEXT_DATE_KEY);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await flushAsyncWork();
    });

    expect(result.current.todayDateKey).toBe(NEXT_DATE_KEY);
    expect(result.current.data?.selectedDate).toBe(NEXT_DATE_KEY);
    expect(offlineMocks.loadSnapshot).toHaveBeenCalledWith(NEXT_DATE_KEY);
  });

  it("does not start drain, fetch, or persistence when a snapshot resolves after unmount", async () => {
    const snapshotResponse = deferred<PointsState | null>();
    const fetchMock = vi.fn();
    offlineMocks.loadSnapshot.mockReturnValue(snapshotResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => usePointsController());
    await waitFor(() => expect(offlineMocks.loadSnapshot).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      snapshotResponse.resolve(makeState());
      await flushAsyncWork();
    });

    expect(syncMocks.drainOutbox).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(offlineMocks.storeRemoteState).not.toHaveBeenCalled();
  });

  it("does not start fetch or persistence when outbox drain resolves after unmount", async () => {
    const drainResponse = deferred<{ completed: boolean; rejected: number }>();
    const fetchMock = vi.fn();
    offlineMocks.loadSnapshot.mockResolvedValue(makeState());
    syncMocks.drainOutbox.mockReturnValue(drainResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => usePointsController());
    await waitFor(() => expect(syncMocks.drainOutbox).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      drainResponse.resolve({ completed: true, rejected: 0 });
      await flushAsyncWork();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(offlineMocks.storeRemoteState).not.toHaveBeenCalled();
  });

  it("does not persist a remote response that resolves after unmount", async () => {
    const remoteResponse = deferred<Response>();
    offlineMocks.loadSnapshot.mockResolvedValue(makeState());
    vi.stubGlobal("fetch", vi.fn(() => remoteResponse.promise));

    const { unmount } = renderHook(() => usePointsController());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      remoteResponse.resolve(Response.json(makeState({ totalNet: 22 })));
      await flushAsyncWork();
    });

    expect(offlineMocks.storeRemoteState).not.toHaveBeenCalled();
  });

  it("persists only the current date when remote responses resolve out of order", async () => {
    const oldRemoteResponse = deferred<Response>();
    const currentRemoteResponse = deferred<Response>();
    const oldCached = makeState({ totalNet: 4 });
    const currentCached = makeState({
      dateKey: NEXT_DATE_KEY,
      totalNet: 4,
      selectedDateNet: 0,
    });
    const oldRemote = makeState({ totalNet: 18 });
    const currentRemote = makeState({
      dateKey: NEXT_DATE_KEY,
      totalNet: 25,
      selectedDateNet: 21,
    });
    let persistedState: PointsState | null = null;
    offlineMocks.loadSnapshot.mockImplementation(async (dateKey: string) =>
      dateKey === NEXT_DATE_KEY ? currentCached : oldCached,
    );
    offlineMocks.storeRemoteState.mockImplementation(async (state: PointsState) => {
      persistedState = state;
      return state;
    });
    const fetchMock = vi.fn((request: string | URL | Request) =>
      String(request).includes(NEXT_DATE_KEY)
        ? currentRemoteResponse.promise
        : oldRemoteResponse.promise,
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePointsController());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    dateMocks.getChangedDateKeyPT.mockReturnValueOnce(NEXT_DATE_KEY);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.todayDateKey).toBe(NEXT_DATE_KEY);
    });

    currentRemoteResponse.resolve(Response.json(currentRemote));
    await waitFor(() => {
      expect(offlineMocks.storeRemoteState).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(currentRemote);
    });

    oldRemoteResponse.resolve(Response.json(oldRemote));
    await act(flushAsyncWork);

    expect(offlineMocks.storeRemoteState).toHaveBeenCalledTimes(1);
    expect(persistedState).toEqual(currentRemote);
    expect(result.current.data).toEqual(currentRemote);
  });

  it("lets only the newest same-date remote request persist and update the hook", async () => {
    const initialRemoteResponse = deferred<Response>();
    const refreshRemoteResponse = deferred<Response>();
    const cached = makeState({ totalNet: 4 });
    const olderRemote = makeState({ totalNet: 8 });
    const newerRemote = makeState({ totalNet: 13 });
    let persistedState: PointsState | null = null;
    offlineMocks.loadSnapshot.mockResolvedValue(cached);
    offlineMocks.storeRemoteState.mockImplementation(async (state: PointsState) => {
      persistedState = state;
      return state;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(initialRemoteResponse.promise)
      .mockReturnValueOnce(refreshRemoteResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePointsController());
    await waitFor(() => {
      expect(result.current.data).toEqual(cached);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    refreshRemoteResponse.resolve(Response.json(newerRemote));
    await waitFor(() => {
      expect(offlineMocks.storeRemoteState).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(newerRemote);
    });

    initialRemoteResponse.resolve(Response.json(olderRemote));
    await act(flushAsyncWork);

    expect(offlineMocks.storeRemoteState).toHaveBeenCalledTimes(1);
    expect(persistedState).toEqual(newerRemote);
    expect(result.current.data).toEqual(newerRemote);
  });

  it("cancels every timer and prevents lifecycle work after unmount", async () => {
    vi.useFakeTimers();
    const state = makeState({ totalNet: 8 });
    offlineMocks.loadSnapshot.mockResolvedValue(state);
    offlineMocks.storeRemoteState.mockResolvedValue(state);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(state)));

    const { unmount } = renderHook(() => usePointsController());
    await act(flushAsyncWork);

    const snapshotCalls = offlineMocks.loadSnapshot.mock.calls.length;
    const fetchCalls = vi.mocked(fetch).mock.calls.length;
    const outboxCalls = syncMocks.drainOutbox.mock.calls.length;

    unmount();
    vi.runAllTimers();
    await flushAsyncWork();

    expect(offlineMocks.loadSnapshot).toHaveBeenCalledTimes(snapshotCalls);
    expect(fetch).toHaveBeenCalledTimes(fetchCalls);
    expect(syncMocks.drainOutbox).toHaveBeenCalledTimes(outboxCalls);
    expect(vi.getTimerCount()).toBe(0);
  });
});
