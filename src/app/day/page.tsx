import type { Metadata } from "next";
import { SerwistProvider } from "@serwist/next/react";
import { getDefaultDayToken } from "@/lib/day-auth";
import { getDayKid } from "@/lib/day-child";
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

export default async function DayPage() {
  const kid = await getDayKid();
  const token = getDefaultDayToken();

  if (!kid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-xl text-center bg-white rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-bold mb-2">未找到孩子</h1>
          <p className="text-sm text-slate-600">
            数据库中还没有孩子记录。请先添加唯一的孩子后再访问 /day。
          </p>
        </div>
      </div>
    );
  }

  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
      options={{ scope: "/day" }}
    >
      <DayKioskPage kidId={kid.id} token={token} />
    </SerwistProvider>
  );
}
