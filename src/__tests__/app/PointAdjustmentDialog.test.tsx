// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PointAdjustmentDialog } from "@/app/points/PointAdjustmentDialog";

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("PointAdjustmentDialog", () => {
  it("exposes an accessible dialog and closes only from Escape or the backdrop", () => {
    const onClose = vi.fn();
    render(
      <PointAdjustmentDialog
        totalPoints={10}
        onClose={onClose}
        onAdjust={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole("dialog", { name: "临时加减分" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = dialog.parentElement;
    expect(backdrop).toBeTruthy();
    fireEvent.mouseDown(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("submits positive and negative adjustments with the expected sign", async () => {
    const onClose = vi.fn();
    const onAdjust = vi.fn().mockResolvedValue(true);
    const { unmount } = render(
      <PointAdjustmentDialog
        totalPoints={10}
        onClose={onClose}
        onAdjust={onAdjust}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "加 1 分" }));

    await waitFor(() => {
      expect(onAdjust).toHaveBeenCalledWith(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    unmount();
    onClose.mockClear();
    onAdjust.mockClear();

    render(
      <PointAdjustmentDialog
        totalPoints={10}
        onClose={onClose}
        onAdjust={onAdjust}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "− 减分" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "减 5 分" }));

    await waitFor(() => {
      expect(onAdjust).toHaveBeenCalledWith(-5);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("blocks close controls while an adjustment is being submitted", async () => {
    const pendingAdjustment = deferred<boolean>();
    const onClose = vi.fn();
    const onAdjust = vi.fn(() => pendingAdjustment.promise);
    render(
      <PointAdjustmentDialog
        totalPoints={10}
        onClose={onClose}
        onAdjust={onAdjust}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "加 1 分" }));

    const closeButton = screen.getByRole("button", {
      name: "关闭临时加减分",
    });
    await waitFor(() => {
      expect((closeButton as HTMLButtonElement).disabled).toBe(true);
    });

    fireEvent.keyDown(window, { key: "Escape" });
    const backdrop = screen.getByRole("dialog").parentElement;
    expect(backdrop).toBeTruthy();
    fireEvent.mouseDown(backdrop!);
    fireEvent.click(closeButton);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      pendingAdjustment.resolve(false);
      await pendingAdjustment.promise;
    });

    await waitFor(() => {
      expect((closeButton as HTMLButtonElement).disabled).toBe(false);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
