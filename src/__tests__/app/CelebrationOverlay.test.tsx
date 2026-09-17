// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CelebrationOverlay } from "@/app/points/CelebrationOverlay";

afterEach(cleanup);

describe("CelebrationOverlay task pictures", () => {
  it("uses the task picture for celebration particles when one is available", () => {
    const { container } = render(
      <CelebrationOverlay
        celebration={{
          emoji: "🧴",
          imageSrc: "/icons/mouthwash.png",
          value: 1,
        }}
      />,
    );

    const particles = container.querySelectorAll(
      'img[src="/icons/mouthwash.png"]',
    );
    expect(particles).toHaveLength(16);
  });

  it("blocks interaction with the page while the celebration is visible", () => {
    render(
      <CelebrationOverlay
        celebration={{ emoji: "⭐", value: 1 }}
      />,
    );

    expect(
      screen.getByText("+1").closest(".fixed")?.classList.contains(
        "pointer-events-none",
      ),
    ).toBe(false);
  });
});
