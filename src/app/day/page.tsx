import DayKioskPage from "./DayKioskPage";

export default function DayPage() {
  const kidId = process.env.NEXT_PUBLIC_DAY_KID_ID || process.env.NEXT_PUBLIC_KIOSK_KID_ID;
  const token = process.env.NEXT_PUBLIC_DAY_TOKEN || process.env.NEXT_PUBLIC_KIOSK_TOKEN;

  if (!kidId || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="max-w-xl text-center bg-white rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-bold mb-2">配置缺失</h1>
          <p className="text-sm text-slate-600">
            请先在环境变量配置 KID_ID 和 TOKEN（例如 NEXT_PUBLIC_DAY_KID_ID / NEXT_PUBLIC_DAY_TOKEN）。
          </p>
        </div>
      </div>
    );
  }

  return <DayKioskPage kidId={kidId} token={token} />;
}
