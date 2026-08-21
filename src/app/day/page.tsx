import type { Metadata } from "next";
import { SerwistProvider } from "@serwist/next/react";
import { prisma } from "@/lib/db";
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

async function getOnlyKidId() {
  const kid = await prisma.user.findFirst({
    where: { role: "KID" },
    select: { id: true },
  });
  return kid?.id ?? null;
}

export default async function DayPage() {
  const kidId = await getOnlyKidId();
  const token = process.env.NEXT_PUBLIC_DAY_TOKEN || process.env.NEXT_PUBLIC_KIOSK_TOKEN || getDefaultDayToken();

  if (!kidId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-xl text-center bg-white rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-bold mb-2">未找到可用孩子</h1>
          <p className="text-sm text-slate-600">
            系统里还没有创建 KID 账号。请先用管理员账号创建孩子后再访问 /day。
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
      <DayKioskPage kidId={kidId} token={token} />
    </SerwistProvider>
  );
}
