"use client";

import type { VisitorLog } from "@/lib/types";
import { formatGpuChipset, formatTime, prettyResolution } from "@/lib/format";

export function StatCards({ logs }: { logs: VisitorLog[] }) {
  const total = logs.length;
  const uniqueIps = new Set(logs.map((l) => l.ip_address).filter(Boolean)).size;
  const mobile = logs.filter((l) => /mobile|tablet/i.test(l.device_type || "")).length;
  const desktop = total - mobile;
  const mobilePct = total ? Math.round((mobile / total) * 100) : 0;
  const withSelfie = logs.filter((l) => l.captured_image).length;
  const withGps = logs.filter((l) => l.latitude !== null && l.longitude !== null).length;

  const cards = [
    {
      tone: "clay-stat-blue",
      label: "Total Clicks",
      value: total,
      sub: "All recorded visits",
      icon: "👆",
    },
    {
      tone: "clay-stat-purple",
      label: "Unique Visitors",
      value: uniqueIps,
      sub: "Distinct IPs",
      icon: "🌐",
    },
    {
      tone: "clay-stat-green",
      label: "Selfie Intel",
      value: withSelfie,
      sub: "Captured images",
      icon: "📸",
    },
    {
      tone: "clay-stat-pink",
      label: "GPS Intel",
      value: withGps,
      sub: "Coordinates pinned",
      icon: "📍",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
      {cards.map((c) => (
        <div key={c.label} className={`clay-panel ${c.tone} rounded-2xl p-3 sm:p-4`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-zinc-700">
              {c.label}
            </p>
            <span className="text-[13px] leading-none opacity-80">{c.icon}</span>
          </div>
          <p className="mt-1.5 text-[22px] sm:text-[26px] font-black text-zinc-900 leading-none tabular-nums">
            {c.value}
          </p>
          <p className="mt-1 text-[9.5px] font-semibold text-zinc-600 truncate">{c.sub}</p>
        </div>
      ))}

      <div className="clay-panel clay-stat-slate rounded-2xl p-3 sm:p-4 col-span-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-zinc-700">
            Device Ratio
          </p>
          <span className="text-[9.5px] font-black text-zinc-600">
            {mobilePct}% Mobile
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/70 overflow-hidden flex shadow-inner">
          <div className="h-full liquid-fill-blue" style={{ width: `${100 - mobilePct}%` }} />
          <div className="h-full liquid-fill-amber" style={{ width: `${mobilePct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-bold text-zinc-600">
          <span>🖥 Desktop · {desktop}</span>
          <span>📱 Mobile · {mobile}</span>
        </div>
      </div>
    </div>
  );
}

/** Compact visitor card with expandable detail + photo/GPS actions. */
export function VisitorCard({
  log,
  index,
  onOpenDeviceInfo,
  onOpenImage,
}: {
  log: VisitorLog;
  index: number;
  onOpenDeviceInfo: (log: VisitorLog) => void;
  onOpenImage: (src: string) => void;
}) {
  const battery = log.battery_level;
  const batteryPct = typeof battery === "number" ? Math.round(battery * 100) : null;

  return (
    <article className="clay-recessed p-3 sm:p-3.5 rounded-2xl animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {log.captured_image ? (
            <button
              onClick={() => onOpenImage(log.captured_image as string)}
              className="clay-thumb-frame w-12 h-12 sm:w-14 sm:h-14 block"
              title="Open captured evidence"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={log.captured_image}
                alt={`Capture from visitor ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ) : (
            <div className="clay-thumb-frame w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-[17px] bg-gradient-to-br from-slate-200 to-slate-300">
              🕵️
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-zinc-900 text-white text-[8px] font-black">
            #{index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-black text-zinc-900 font-mono">
              {log.ip_address || "unknown"}
            </span>
            <span className="text-[9px] font-bold text-zinc-500">
              {formatTime(log.created_at)}
            </span>
            {log.device_type ? (
              <span className="clay-small-pill px-1.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider text-zinc-700">
                {log.device_type}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] font-bold text-zinc-700 truncate mt-0.5">
            {log.location_name || "Location unavailable"}
          </p>
          <p className="text-[10px] font-semibold text-zinc-500 truncate">
            {[log.os, log.os_version].filter(Boolean).join(" ") || "Unknown OS"}
            {" · "}
            {[log.browser, log.browser_version].filter(Boolean).join(" ") || "Unknown browser"}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[9px] font-black text-zinc-500">
            {prettyResolution(log.screen_resolution)}
          </span>
          {batteryPct !== null ? (
            <span className="w-14 h-2 rounded-full bg-white/80 overflow-hidden shadow-inner">
              <span
                className={`block h-full ${
                  batteryPct > 50
                    ? "liquid-fill-green"
                    : batteryPct > 20
                      ? "liquid-fill-amber"
                      : "liquid-fill-red"
                }`}
                style={{ width: `${batteryPct}%` }}
              />
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onOpenDeviceInfo(log)}
          className="px-2.5 py-1 rounded-full bg-white/80 border border-white text-[9.5px] font-black uppercase tracking-wider text-zinc-800 hover:bg-white active:scale-95 transition-all"
        >
          Full Specs
        </button>
        {log.latitude !== null && log.longitude !== null ? (
          <a
            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[9.5px] font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100 active:scale-95 transition-all"
          >
            View GPS Pin
          </a>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-white/60 border border-white text-[9.5px] font-black uppercase tracking-wider text-zinc-400">
            No GPS
          </span>
        )}
        {log.captured_image ? (
          <button
            onClick={() => onOpenImage(log.captured_image as string)}
            className="px-2.5 py-1 rounded-full bg-fuchsia-50 border border-fuchsia-200 text-[9.5px] font-black uppercase tracking-wider text-fuchsia-800 hover:bg-fuchsia-100 active:scale-95 transition-all"
          >
            Capture image
          </button>
        ) : null}
        <span className="ml-auto text-[9px] font-bold text-zinc-400 truncate max-w-[9rem]">
          {formatGpuChipset(log.gpu_chipset)}
        </span>
      </div>
    </article>
  );
}
