"use client";

import { useCallback, useRef } from "react";

export function useCelebrationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(() => {
    if (typeof window === "undefined") return;

    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/celebration.mp3");
      audioRef.current.volume = 0.5;
    }

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Autoplay may be blocked by browser - fail silently
    });
  }, []);

  return { play };
}
