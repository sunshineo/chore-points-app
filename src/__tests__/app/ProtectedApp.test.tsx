// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EXPLICIT_LOCK_KEY, OFFLINE_AUTH_KEY } from "@/lib/offline-auth";

vi.mock("@/app/PointsPage", () => ({
  default: () => <div>points-unlocked</div>,
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
});
