"use client";

import { useEffect, useState } from "react";
import { MAX_MANUAL_ADJUSTMENT_POINTS } from "@/lib/points";

type AdjustmentMode = "add" | "subtract";

export type PointAdjustmentDialogProps = {
  totalPoints: number;
  onClose: () => void;
  onAdjust: (points: number) => Promise<boolean>;
};

const QUICK_ADJUSTMENT_AMOUNTS = [1, 2, 3, 5, 10];

export function PointAdjustmentDialog({
  totalPoints,
  onClose,
  onAdjust,
}: PointAdjustmentDialogProps) {
  const [mode, setMode] = useState<AdjustmentMode>("add");
  const [amount, setAmount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const selectMode = (nextMode: AdjustmentMode) => {
    setMode(nextMode);
    setValidationMessage(null);
  };

  const submitAdjustment = async () => {
    const parsedAmount = Number(amount);
    if (
      !Number.isInteger(parsedAmount) ||
      parsedAmount < 1 ||
      parsedAmount > MAX_MANUAL_ADJUSTMENT_POINTS
    ) {
      setValidationMessage(`请输入 1–${MAX_MANUAL_ADJUSTMENT_POINTS} 的整数`);
      return;
    }
    if (mode === "subtract" && parsedAmount > totalPoints) {
      setValidationMessage(`当前最多可减 ${totalPoints} 分`);
      return;
    }

    setSubmitting(true);
    setValidationMessage(null);
    const applied = await onAdjust(mode === "add" ? parsedAmount : -parsedAmount);
    setSubmitting(false);
    if (applied) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjustment-title"
        className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="adjustment-title" className="text-2xl font-black text-slate-900">临时加减分</h2>
            <p className="mt-1 text-sm text-slate-500">不关联任务或奖励，直接调整总积分</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500 disabled:opacity-50"
            aria-label="关闭临时加减分"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3" aria-label="选择加分或减分">
          <button
            type="button"
            onClick={() => selectMode("add")}
            className={`rounded-2xl border-2 px-4 py-3 text-lg font-black transition ${
              mode === "add"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            ＋ 加分
          </button>
          <button
            type="button"
            onClick={() => selectMode("subtract")}
            disabled={totalPoints <= 0}
            className={`rounded-2xl border-2 px-4 py-3 text-lg font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "subtract"
                ? "border-rose-500 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            − 减分
          </button>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-bold text-slate-700">分值</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MANUAL_ADJUSTMENT_POINTS}
            step={1}
            autoFocus
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setValidationMessage(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitAdjustment();
            }}
            className="mt-2 w-full rounded-2xl border-2 border-indigo-100 bg-indigo-50/60 px-4 py-3 text-center text-3xl font-black text-indigo-700 outline-none transition focus:border-indigo-400"
            aria-describedby={validationMessage ? "adjustment-error" : undefined}
          />
        </label>

        <div className="mt-3 grid grid-cols-5 gap-2" aria-label="常用分值">
          {QUICK_ADJUSTMENT_AMOUNTS.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => {
                setAmount(String(quickAmount));
                setValidationMessage(null);
              }}
              className={`rounded-xl py-2 text-sm font-bold ${
                amount === String(quickAmount)
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {quickAmount}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-6 text-center text-sm font-medium" aria-live="polite">
          {validationMessage ? <span id="adjustment-error" className="text-rose-600">{validationMessage}</span> : null}
          {!validationMessage && mode === "subtract" ? (
            <span className="text-slate-500">当前共有 {totalPoints} 分</span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void submitAdjustment()}
          disabled={submitting}
          className={`mt-2 w-full rounded-2xl py-4 text-lg font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60 ${
            mode === "add"
              ? "bg-emerald-500 shadow-emerald-200"
              : "bg-rose-500 shadow-rose-200"
          }`}
        >
          {submitting ? "正在保存…" : `${mode === "add" ? "加" : "减"} ${amount || 0} 分`}
        </button>
      </section>
    </div>
  );
}
