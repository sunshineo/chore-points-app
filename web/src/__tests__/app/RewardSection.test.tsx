// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RewardSection } from "@/app/points/RewardSection";
import type { PointsState } from "@/lib/points";

afterEach(cleanup);

const rewards: PointsState["rewards"] = [
  {
    id: "test-affordable-reward",
    title: "小奖励",
    emoji: "🍬",
    cost: 5,
    redeemedCount: 0,
  },
  {
    id: "test-redeemed-reward",
    title: "已兑换奖励",
    emoji: "🎁",
    cost: 10,
    redeemedCount: 1,
  },
];

describe("RewardSection", () => {
  it("allows affordable rewards and disables unaffordable rewards in normal mode", () => {
    const onRedeem = vi.fn();
    render(
      <RewardSection
        rewards={rewards}
        currentPoints={5}
        disabled={false}
        isUndoMode={false}
        onRedeem={onRedeem}
      />,
    );

    const affordableReward = screen.getByRole("button", { name: /小奖励/ });
    const unaffordableReward = screen.getByRole("button", {
      name: /已兑换奖励/,
    });
    expect((affordableReward as HTMLButtonElement).disabled).toBe(false);
    expect((unaffordableReward as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(affordableReward);
    fireEvent.click(unaffordableReward);

    expect(onRedeem).toHaveBeenCalledTimes(1);
    expect(onRedeem).toHaveBeenCalledWith("test-affordable-reward");
  });

  it("allows only previously redeemed rewards in undo mode", () => {
    const onRedeem = vi.fn();
    render(
      <RewardSection
        rewards={rewards}
        currentPoints={0}
        disabled={false}
        isUndoMode
        onRedeem={onRedeem}
      />,
    );

    const neverRedeemedReward = screen.getByRole("button", { name: /小奖励/ });
    const redeemedReward = screen.getByRole("button", {
      name: /已兑换奖励/,
    });
    expect((neverRedeemedReward as HTMLButtonElement).disabled).toBe(true);
    expect((redeemedReward as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(neverRedeemedReward);
    fireEvent.click(redeemedReward);

    expect(onRedeem).toHaveBeenCalledTimes(1);
    expect(onRedeem).toHaveBeenCalledWith("test-redeemed-reward");
  });

  it("keeps all rewards disabled when the section is busy", () => {
    const onRedeem = vi.fn();
    render(
      <RewardSection
        rewards={rewards}
        currentPoints={100}
        disabled
        isUndoMode={false}
        onRedeem={onRedeem}
      />,
    );

    const rewardButtons = screen.getAllByRole("button");
    expect(rewardButtons).toHaveLength(2);
    for (const button of rewardButtons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }

    rewardButtons.forEach((button) => fireEvent.click(button));
    expect(onRedeem).not.toHaveBeenCalled();
  });
});
