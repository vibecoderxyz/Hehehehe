"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { StatCards, VisitorCard } from "@/components/VisitorCard";
import type { VisitorLog } from "@/lib/types";

export function AnalyticsPanel() {
  const { links, selected, setSelected, setDeviceInfo, setLightbox, click, deviceId, phone, loadingLinks } =
    useApp();
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!selected) {
      setLogs([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { api } = await import("@/lib/client");
      const res = await api.analytics({
        urlId: selected.id,
        shortCode: selected.short_code,
        deviceId,
        phone,
      });
      setLogs(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load visitor records.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selected, deviceId, phone]);

  useEffect(() => {
    void load();
  }, [load]);

  /* auto-refresh every 30s while a link is selected */
  useEffect(() => {
    if (!selected) return;
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [selected, load]);

  /* auto-pick the newest link so the tab is never blank */
  useEffect(() => {
    if (!selected && links.length > 0) setSelected(links[0]);
  }, [links, selected, setSelected]);

  if (!selected) {
    return (
      <div className="clay-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[#152432] font-extrabold text-[18px]">
              📊 Link Analytics &amp; Intelligence
            </h3>
            <p className="text-[12px] font-semibold text-[#31495e]">
              Select a link below to view opted-in visitor analytics, GPS and camera photos
            </p>
          </div>
        </div>

        {loadingLinks ? (
          <div className="py-12 flex justify-center">
            <span className="w-8 h-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {links.map((l) => (
              <button
                key={l.short_code}
                onClick={() => {
                  click(560);
                  setSelected(l);
                }}
                className="clay-recessed p-4 flex items-center justify-between group transition-all hover:-translate-y-0.5 text-left"
              >
                <span className="flex items-center gap-3.5 min-w-0">
                  <span className="clay-thumb-frame w-11 h-11 flex items-center justify-center text-white shrink-0 bg-gradient-to-br from-[#4b82bd] to-[#285180]">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 4-6" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-[#122230] truncate font-mono">
                      /{l.short_code}
                    </span>
                    <span className="block text-[11px] font-semibold text-[#344b5e] truncate">
                      {l.long_url}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="clay-small-pill px-3 py-1 text-xs font-bold text-[#142331]">
                    View Intel
                  </span>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#265e6b] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                </span>
              </button>
            ))}
            {links.length === 0 ? (
              <div className="text-center py-12 text-[#31495e] font-semibold text-xs">
                No links generated yet. Create a link first!
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="liquid-glass-box rounded-[24px] sm:rounded-[30px] p-3.5 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-blue-700">
              Opt-in Visitor Telemetry
            </p>
            <h2 className="text-[16px] sm:text-[20px] font-black text-zinc-900 truncate font-mono">
              /{selected.short_code}
            </h2>
            <p className="text-[10.5px] font-semibold text-zinc-500 truncate">
              {selected.long_url}
            </p>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="shrink-0 px-3 py-1.5 rounded-full bg-white/70 border border-white text-[10px] font-black uppercase tracking-wider text-zinc-700 hover:bg-white active:scale-95 transition-all"
          >
            Switch
          </button>
        </div>

        <StatCards logs={logs} />

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[12.5px] font-black text-zinc-900">Live Visitor Records</h3>
            <span className="px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800 font-mono text-[10.5px] font-extrabold">
              {logs.length} logs
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-mono text-zinc-500 hidden sm:inline">
              Auto-refresh: 30s
            </span>
            <button
              onClick={() => {
                click(560);
                void load();
              }}
              className="px-2.5 py-1 rounded-full bg-white/75 border border-white text-[9.5px] font-black uppercase tracking-wider text-zinc-700 hover:bg-white active:scale-95 transition-all flex items-center gap-1"
            >
              <svg viewBox="0 0 24 24" className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 3v6h-6" /></svg>
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-2 text-[11px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3 py-2">
            ⚠️ {error}
          </p>
        ) : null}

        <div className="mt-2.5 space-y-2.5 max-h-[600px] overflow-y-auto clay-scroll pr-0.5">
          {loading && logs.length === 0 ? (
            <div className="py-10 flex justify-center">
              <span className="w-8 h-8 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
            </div>
          ) : null}

          {logs.map((log, i) => (
            <VisitorCard
              key={log.id || i}
              log={log}
              index={i}
              onOpenDeviceInfo={setDeviceInfo}
              onOpenImage={setLightbox}
            />
          ))}

          {!loading && logs.length === 0 && !error ? (
            <div className="clay-recessed p-10 text-center rounded-3xl">
              <p className="text-3xl mb-2 opacity-60">📡</p>
              <p className="text-zinc-800 font-black text-base">No visitors recorded yet</p>
              <p className="text-zinc-500 text-xs mt-1">
                Visitors who opt in can share selected analytics; camera and GPS are separate choices.
              </p>
              <button
                onClick={async () => {
                  const { copyText } = await import("@/lib/client");
                  const { shortUrlFor } = await import("@/lib/client");
                  await copyText(shortUrlFor(selected.short_code, window.location.origin));
                }}
                className="mt-3 px-3 py-1.5 rounded-full bg-white/85 border border-white text-[10px] font-black uppercase tracking-wider text-blue-700 hover:bg-white active:scale-95 transition-all"
              >
                Copy short link
              </button>
            </div>
          ) : null}
        </div>

        {deviceId || phone ? (
          <p className="mt-2.5 text-[9.5px] font-mono text-zinc-400 truncate">
            Sync key: {phone || deviceId}
          </p>
        ) : null}
      </section>
    </div>
  );
}
