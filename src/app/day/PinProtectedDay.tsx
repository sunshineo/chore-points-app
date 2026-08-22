"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DayKioskPage from "./DayKioskPage";

type AuthState = "checking" | "locked" | "unlocked";

type AuthResponse = {
  authenticated?: boolean;
  configured?: boolean;
  error?: string;
  expiresAt?: number;
};

const OFFLINE_AUTH_KEY = "gemsteps-kiosk-unlocked-until";
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"] as const;

function hasOfflineSession(): boolean {
  const expiresAt = Number(window.localStorage.getItem(OFFLINE_AUTH_KEY));
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function PinEntry({ onUnlocked }: { onUnlocked: (expiresAt: number) => void }) {
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submitPin = useCallback(async (candidate: string) => {
    if (candidate.length !== 6 || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      const body = (await response.json().catch(() => null)) as AuthResponse | null;
      if (!response.ok || !body?.authenticated || typeof body.expiresAt !== "number") {
        throw new Error(body?.error ?? "暂时无法验证密码");
      }

      onUnlocked(body.expiresAt);
    } catch (error) {
      setPin("");
      setErrorMessage(error instanceof Error ? error.message : "暂时无法验证密码");
      window.navigator.vibrate?.(120);
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [onUnlocked, submitting]);

  const updatePin = useCallback((value: string) => {
    if (submitting) return;
    const next = value.replace(/\D/g, "").slice(0, 6);
    setPin(next);
    setErrorMessage(null);
    if (next.length === 6) void submitPin(next);
  }, [submitPin, submitting]);

  const handleKeypad = useCallback((key: (typeof DIGITS)[number]) => {
    inputRef.current?.focus();
    if (key === "" || submitting) return;
    if (key === "delete") {
      updatePin(pin.slice(0, -1));
      return;
    }
    updatePin(`${pin}${key}`);
  }, [pin, submitting, updatePin]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 px-5 py-8 flex items-center justify-center">
      <section className="w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-indigo-200/70 backdrop-blur sm:p-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl shadow-lg shadow-indigo-200" aria-hidden="true">
          🔒
        </div>
        <h1 className="text-center text-2xl font-black text-slate-900">请输入密码</h1>
        <p className="mt-2 text-center text-sm text-slate-500">输入六位数字，打开 GemSteps</p>

        <label className="mt-6 block">
          <span className="sr-only">六位数字密码</span>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="current-password"
            autoFocus
            maxLength={6}
            value={pin}
            disabled={submitting}
            onChange={(event) => updatePin(event.target.value)}
            className="w-full rounded-2xl border-2 border-indigo-100 bg-indigo-50/70 px-3 py-4 text-center text-3xl font-black tracking-[0.65em] text-indigo-700 caret-indigo-600 outline-none transition focus:border-indigo-400 disabled:opacity-70"
            aria-describedby={errorMessage ? "pin-error" : undefined}
          />
        </label>

        <div className="mt-5 grid grid-cols-3 gap-3" aria-label="数字键盘">
          {DIGITS.map((key, index) => {
            if (key === "") return <div key={`empty-${index}`} aria-hidden="true" />;
            const label = key === "delete" ? "⌫" : key;
            return (
              <button
                key={key}
                type="button"
                disabled={submitting}
                onClick={() => handleKeypad(key)}
                className="h-16 rounded-2xl bg-slate-100 text-2xl font-bold text-slate-800 shadow-sm transition active:scale-95 active:bg-indigo-100 disabled:opacity-50"
                aria-label={key === "delete" ? "删除一位" : `数字 ${key}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 min-h-6 text-center text-sm font-medium" aria-live="polite">
          {submitting ? <span className="text-indigo-600">正在验证…</span> : null}
          {!submitting && errorMessage ? <span id="pin-error" className="text-rose-600">{errorMessage}</span> : null}
        </div>
      </section>
    </main>
  );
}

export default function PinProtectedDay() {
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as AuthResponse | null;
        if (!cancelled) setAuthState(response.ok && body?.authenticated ? "unlocked" : "locked");
      } catch {
        if (!cancelled) setAuthState(hasOfflineSession() ? "unlocked" : "locked");
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnlocked = useCallback((expiresAt: number) => {
    window.localStorage.setItem(OFFLINE_AUTH_KEY, String(expiresAt));
    setAuthState("unlocked");
  }, []);

  const handleLock = useCallback(async () => {
    window.localStorage.removeItem(OFFLINE_AUTH_KEY);
    setAuthState("locked");
    await fetch("/api/auth", { method: "DELETE" }).catch(() => null);
  }, []);

  if (authState === "checking") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 flex items-center justify-center">
        <div className="text-center text-indigo-700">
          <div className="text-4xl animate-pulse" aria-hidden="true">🔒</div>
          <p className="mt-3 text-sm font-semibold">正在检查密码…</p>
        </div>
      </main>
    );
  }

  if (authState === "locked") return <PinEntry onUnlocked={handleUnlocked} />;
  return <DayKioskPage onLock={handleLock} />;
}
