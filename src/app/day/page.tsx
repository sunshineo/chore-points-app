import type { Metadata } from "next";
import { SerwistProvider } from "@serwist/next/react";
import { getDefaultDayToken } from "@/lib/day-auth";
import DayKioskPage from "./DayKioskPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GemSteps Day",
  description: "Daily chores, points, and rewards",
  manifest: "/day.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GemSteps Day",
    statusBarStyle: "default",
  },
};

export default function DayPage() {
  const token = getDefaultDayToken();

  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
      options={{ scope: "/day" }}
    >
      <DayKioskPage token={token} />
    </SerwistProvider>
  );
}
