"use client";

import { useState, useEffect, useCallback } from "react";
import PointsCelebration from "./PointsCelebration";

type PointsCelebrationWrapperProps = {
  kidId: string;
  currentPoints: number;
  children: React.ReactNode;
};

export default function PointsCelebrationWrapper({
  kidId,
  currentPoints,
  children,
}: PointsCelebrationWrapperProps) {
  const [lastViewedPoints, setLastViewedPoints] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch last viewed points on mount
  useEffect(() => {
    async function fetchLastViewed() {
      try {
        const res = await fetch(`/api/points/last-viewed?kidId=${kidId}`);
        if (res.ok) {
          const data = await res.json();
          setLastViewedPoints(data.lastViewedPoints ?? 0);
        } else {
          // If endpoint fails, just skip celebration
          setLastViewedPoints(null);
        }
      } catch {
        setLastViewedPoints(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLastViewed();
  }, [kidId]);

  // Determine if celebration should play
  useEffect(() => {
    if (
      !isLoading &&
      lastViewedPoints !== null &&
      currentPoints > lastViewedPoints
    ) {
      setShowCelebration(true);
    }
  }, [isLoading, lastViewedPoints, currentPoints]);

  // Handle celebration complete
  const handleCelebrationComplete = useCallback(async () => {
    // Update database with new last viewed points
    try {
      await fetch("/api/points/last-viewed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: currentPoints, kidId }),
      });
    } catch (error) {
      console.error("Failed to update last viewed points:", error);
    }

    setShowCelebration(false);
    setLastViewedPoints(currentPoints);
  }, [currentPoints, kidId]);

  return (
    <>
      {showCelebration && lastViewedPoints !== null && (
        <PointsCelebration
          fromPoints={lastViewedPoints}
          toPoints={currentPoints}
          onComplete={handleCelebrationComplete}
        />
      )}
      {children}
    </>
  );
}
