"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { copyText, shortUrlFor } from "@/lib/client";

/**
 * "Recent Links History" tab.
 * Lists every link the current device / phone / account owns with inline
 * Intel / Copy / Manage / Delete actions — no dead buttons.
 */
export function RecentPanel() {
  const {
    links,
    loadingLinks,
    refreshLinks,
    click,
    origin,
    toast,
    setTab,
    setSelected,
    setManageCode,
    removeLink,
    deviceId,
    phone,
  } = useApp();
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const copy = async (code: string) => {
    click(600);
    const ok = await copyText(shortUrlFor(code, origin));
    toast(ok ? "Short link copied!" : "Copy blocked by the browser", ok ? "success" : "error");
  };

  const destroy = async (code: string) => {
    if (!window.confirm(`Delete /${code}? Visitor records stay in the log.`)) return;
    setBusyCode(code);
    try {
      const { api } = await import("@/lib/client");
      await api.deleteLink(code, deviceId, phone);
      removeLink(code);
      toast("Link deleted.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the link.", "error");
    } finally {
      setBusyCode(null);
    }
  };

  const filtered = query.trim()
    ? links.filter(
        (l) =>
          l.short_code.toLowerCase().includes(query.trim().toLowerCase()) ||
          l.long_url.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : links;

  return (
    <div className="space-y-4 animate-in">
      <section className="clay-panel p-4 sm:p-6">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 mb-4">
          <div className="min-w-0">
            <h2 className="text-[#152432] font-extrabold text-base sm:text-xl flex items-center gap-2">
              <span className="text-lg sm:text-xl">🕘</span>
              <span>Recent Generated Links</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-[#31495e] font-semibold mt-0.5">
              Tap Intel to view live visitor logs, GPS and camera photos
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {links.length > 0 ? (
              <button
                onClick={() => {
                  click(420);
                  void refreshLinks();
                  toast("History refreshed.", "info");
                }}
                className="clay-small-pill px-2.5 py-1 text-[10px] font-bold text-[#12303a] hover:text-teal-800 active:scale-95 transition-all"
              >
                Refresh
              </button>
            ) : null}
            <span className="clay-badge-teal px-2 py-0.5 text-xs text-white font-mono font-bold">
              {links.length}
            </span>
          </div>
        </div>

        {links.length > 0 ? (
          <div className="mb-3 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search alias or destination…"
              className="flex-1 liquid-glass-input px-3.5 py-2 text-[12px] font-semibold"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="clay-small-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-700 active:scale-95 transition-all"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2.5">
          {loadingLinks && links.length === 0 ? (
            <div className="py-12 flex justify-center">
              <span className="w-8 h-8 rounded-full border-[3px] border-teal-600 border-t-transparent animate-spin" />
            </div>
          ) : null}

          {filtered.map((l) => (
            <div
              key={l.short_code}
              className="clay-recessed p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-transform hover:-translate-y-0.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs sm:text-sm font-extrabold text-[#0e3b44] font-mono">
                    /{l.short_code}
                  </span>
                  {l.password_hash ? (
                    <span className="clay-small-pill px-2 py-0.5 text-[8px] sm:text-[9px] font-bold text-amber-800">
                      Lock
                    </span>
                  ) : null}
                  {l.social_gate_title ? (
                    <span className="clay-small-pill px-2 py-0.5 text-[8px] sm:text-[9px] font-bold text-blue-800">
                      Gate
                    </span>
                  ) : null}
                  {l.capture_camera ? (
                    <span className="clay-badge-teal px-1.5 py-0.5 text-[8px] sm:text-[9px] text-white">
                      Cam
                    </span>
                  ) : null}
                  {l.capture_location ? (
                    <span className="clay-badge-slate px-1.5 py-0.5 text-[8px] sm:text-[9px] text-[#142332]">
                      GPS
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-[#344f63] font-medium truncate">{l.long_url}</p>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t border-white/20 sm:border-0 shrink-0">
                <button
                  onClick={() => {
                    click(560);
                    setSelected(l);
                    setTab("analytics");
                  }}
                  className="glass-orb orb-blue px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 text-white active:scale-95 flex-1 sm:flex-none shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 4-6" /></svg>
                  <span>Intel</span>
                </button>
                <button
                  onClick={() => void copy(l.short_code)}
                  className="glass-orb orb-clear p-2 min-w-[36px] flex items-center justify-center text-zinc-800 active:scale-95"
                  title="Copy Link"
                  aria-label={`Copy ${l.short_code}`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></svg>
                </button>
                <button
                  onClick={() => {
                    click(650);
                    setManageCode(l.short_code);
                  }}
                  className="glass-orb orb-champagne p-2 min-w-[36px] flex items-center justify-center text-zinc-800 active:scale-95"
                  title="Manage Link"
                  aria-label={`Manage ${l.short_code}`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                </button>
                <button
                  onClick={() => void destroy(l.short_code)}
                  disabled={busyCode === l.short_code}
                  className="glass-orb orb-clear p-2 min-w-[36px] flex items-center justify-center text-rose-600 hover:text-rose-700 active:scale-95 disabled:opacity-50"
                  title="Delete Link"
                  aria-label={`Delete ${l.short_code}`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
                </button>
              </div>
            </div>
          ))}

          {!loadingLinks && filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-3xl mb-2 opacity-60">🔗</p>
              <p className="text-[#31495e] font-bold text-xs sm:text-sm">
                {links.length === 0
                  ? 'No links generated yet. Tap "Shorten" to create your first link!'
                  : "No link matches that search."}
              </p>
              {links.length === 0 ? (
                <button
                  onClick={() => {
                    click(520);
                    setTab("create");
                  }}
                  className="mt-3 glass-orb orb-blue px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white active:scale-95"
                >
                  Shorten a URL
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}