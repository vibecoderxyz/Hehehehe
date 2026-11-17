"use client";

import { useEffect, useRef } from "react";

/**
 * Modal shell: glass board, blurred backdrop, ESC-to-close, scroll lock and
 * click-outside dismissal. Every dialog in the app uses it so behaviour stays
 * consistent across desktop and mobile (bottom-sheet on small screens).
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = "max-w-2xl",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm cursor-default"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(18px) saturate(140%)" }}
        className={`clay-board relative w-full ${maxWidth} max-h-[88dvh] flex flex-col rounded-[28px] overflow-hidden bg-white/90 backdrop-blur-2xl animate-slide-in-bottom outline-none`}
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-300/50">
          <div className="flex items-center gap-3 min-w-0">
            {icon ? (
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-base font-black text-zinc-900 leading-tight truncate">
                {title}
              </h2>
              {subtitle ? (
                <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 leading-snug">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="clay-circle-grey w-9 h-9 shrink-0 text-zinc-900 active:scale-90"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto clay-scroll px-4 sm:px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 px-4 sm:px-5 py-3 border-t border-zinc-300/50 bg-white/40">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
