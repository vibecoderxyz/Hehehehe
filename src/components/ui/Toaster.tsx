"use client";

import { useApp } from "@/components/AppProvider";

/** Fixed toast stack (bottom centre, above the dock). */
export function Toaster() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-[90] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-6 w-[min(92vw,26rem)] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={[
            "pointer-events-auto w-full text-left px-4 py-3 rounded-2xl border-2 backdrop-blur-xl shadow-lg animate-slide-up flex items-start gap-2.5",
            t.kind === "success"
              ? "bg-emerald-50/95 border-emerald-300 text-emerald-900"
              : t.kind === "error"
                ? "bg-rose-50/95 border-rose-300 text-rose-900"
                : "bg-white/95 border-zinc-200 text-zinc-800",
          ].join(" ")}
        >
          <span className="text-base leading-none mt-0.5">
            {t.kind === "success" ? "✅" : t.kind === "error" ? "⚠️" : "ℹ️"}
          </span>
          <span className="text-[12.5px] font-bold leading-snug">{t.message}</span>
        </button>
      ))}
    </div>
  );
}