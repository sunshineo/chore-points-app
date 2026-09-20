// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EXPLICIT_LOCK_KEY, OFFLINE_AUTH_KEY } from "@/lib/offline-auth";

vi.mock("@/app/PointsPage", () => ({
  default: ({ onLock }: { onLock: () => void }) => (
    <div>
      points-unlocked
      <button type="button" onClick={onLock}>lock-page</button>
    </div>
  ),
}));

import ProtectedApp from "@/app/ProtectedApp";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("ProtectedApp sticky lock", () => {
  it("shows the PIN screen without trusting or fetching an online cookie", async () => {
    window.localStorage.setItem(EXPLICIT_LOCK_KEY, "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProtectedApp />);

    expect(await screen.findByText("请输入密码")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the explicit lock only after a successful PIN submission", async () => {
    const expiresAt = Date.now() + 60_000;
    window.localStorage.setItem(EXPLICIT_LOCK_KEY, "1");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ authenticated: true, expiresAt }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ProtectedApp />);
    fireEvent.change(await screen.findByLabelText("六位数字密码"), {
      target: { value: "123456" },
    });

    expect(await screen.findByText("points-unlocked")).toBeTruthy();
    await waitFor(() => {
      expect(window.localStorage.getItem(EXPLICIT_LOCK_KEY)).toBeNull();
      expect(window.localStorage.getItem(OFFLINE_AUTH_KEY)).toBe(String(expiresAt));
    });
  });

  it("settles the lock DELETE before an immediate PIN unlock POST", async () => {
    let settleDelete!: (response: Response) => void;
    const deleteResponse = new Promise<Response>((resolve) => {
      settleDelete = resolve;
    });
    const expiresAt = Date.now() + 60_000;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return deleteResponse;
      if (init?.method === "POST") {
        return Promise.resolve(Response.json({ authenticated: true, expiresAt }));
      }
      return Promise.resolve(Response.json({ authenticated: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProtectedApp />);
    expect(await screen.findByText("points-unlocked")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "lock-page" }));

    const pinInput = await screen.findByLabelText("六位数字密码");
    expect(window.localStorage.getItem(EXPLICIT_LOCK_KEY)).toBe("1");
    fireEvent.change(pinInput, { target: { value: "123456" } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);

    await act(async () => {
      settleDelete(new Response(null, { status: 204 }));
      await deleteResponse;
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
    expect(await screen.findByText("points-unlocked")).toBeTruthy();
    expect(window.localStorage.getItem(EXPLICIT_LOCK_KEY)).toBeNull();
    expect(window.localStorage.getItem(OFFLINE_AUTH_KEY)).toBe(String(expiresAt));
  });
});
