export function AuthCheckingStatus() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 flex items-center justify-center">
      <div className="text-center text-indigo-700">
        <div className="text-4xl animate-pulse" aria-hidden="true">🔒</div>
        <p className="mt-3 text-sm font-semibold">正在检查密码…</p>
      </div>
    </main>
  );
}

export function PointsLoadingStatus() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="text-4xl animate-pulse">⏳</div>
    </div>
  );
}

export function PointsLoadErrorStatus({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-sm text-red-600">
      <div>加载失败：{message}</div>
    </div>
  );
}
