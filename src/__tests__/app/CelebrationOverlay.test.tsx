// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
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
});
