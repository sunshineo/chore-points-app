"use client";

import { useEffect, type ReactNode } from "react";

type DialogShellProps = {
  titleId: string;
  title: string;
  description: string;
  closeLabel: string;
  closeDisabled: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function DialogShell({
  titleId,
  title,
  description,
  closeLabel,
  closeDisabled,
  onClose,
  children,
}: DialogShellProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDisabled, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-2xl font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500 disabled:opacity-50"
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}
