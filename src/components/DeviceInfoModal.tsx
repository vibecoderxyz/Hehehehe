"use client";

import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { formatGpuChipset, prettyResolution } from "@/lib/format";
import type { VisitorLog } from "@/lib/types";

function Row({
  label,
  value,
  mono = true,
  action,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-200/70 last:border-0">
      <span className="w-[8.5rem] shrink-0 text-[10px] font-black uppercase tracking-wider text-zinc-500 pt-0.5">
        {label}
      </span>
      <span
        className={`flex-1 min-w-0 text-[12px] font-bold text-zinc-900 break-words ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}

export function DeviceInfoModal() {
  const { deviceInfo, setDeviceInfo, toast } = useApp();
  const log: VisitorLog | null = deviceInfo;

  return (
    <Modal
      open={!!log}
      onClose={() => setDeviceInfo(null)}
      title="Device & Network Intelligence"
      subtitle={log ? `Visit captured ${new Date(log.created_at).toLocaleString()}` : undefined}
      icon={<span className="text-lg">🧠</span>}
      maxWidth="max-w-xl"
    >
      {log ? (
        <div className="space-y-3">
          <div className="clay-recessed rounded-2xl px-3">
            <Row
              label="IP Address"
              value={log.ip_address || "unknown"}
              action={
                <a
                  href={`https://ipinfo.io/${log.ip_address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded-full bg-white/85 border border-white text-[9.5px] font-black uppercase tracking-wider text-blue-700 hover:bg-white"
                >
                  Lookup
                </a>
              }
            />
            <Row label="Location" value={log.location_name || "Unavailable"} mono={false} />
            <Row label="Coordinates" value={
              log.latitude !== null && log.longitude !== null
                ? `${log.latitude}, ${log.longitude}`
                : "Not shared"
            } />
            <Row label="Device Model" value={log.device_model || "Unknown"} mono={false} />
            <Row label="Device Type" value={log.device_type || "Unknown"} mono={false} />
            <Row label="OS Version" value={[log.os, log.os_version].filter(Boolean).join(" ") || "Unknown"} />
            <Row label="Browser" value={[log.browser, log.browser_version].filter(Boolean).join(" ") || "Unknown"} />
            <Row label="Screen" value={`${prettyResolution(log.screen_resolution)} · ${log.screen_color_depth || "?"}bit`} />
            <Row label="GPU / Chipset" value={formatGpuChipset(log.gpu_chipset)} />
            <Row label="Timezone" value={log.timezone || "Unknown"} />
            <Row label="Language" value={log.language || "Unknown"} />
            <Row label="CPU Cores" value={log.hardware_concurrency ?? "Unknown"} />
            <Row label="Device RAM" value={log.device_memory ? `${log.device_memory} GB` : "Unknown"} />
            <Row label="Touch Points" value={log.touch_points ?? 0} />
            <Row
              label="Battery"
              value={
                typeof log.battery_level === "number"
                  ? `${Math.round(log.battery_level * 100)}%${log.is_charging ? " ⚡ charging" : ""}`
                  : "Unknown"
              }
            />
            <Row label="Network" value={log.network_type || "Unknown"} />
            <Row label="WebGL Vendor" value={log.webgl_vendor || "Unknown"} />
            <Row label="WebGL Renderer" value={log.webgl_renderer || "Unknown"} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                Raw User Agent
              </span>
              <button
                onClick={async () => {
                  const { copyText } = await import("@/lib/client");
                  const ok = await copyText(log.raw_user_agent || log.user_agent || "");
                  toast(ok ? "User agent copied." : "Copy blocked by the browser", ok ? "success" : "error");
                }}
                className="px-2 py-0.5 rounded-full bg-white/85 border border-white text-[9.5px] font-black uppercase tracking-wider text-blue-700 hover:bg-white"
              >
                Copy
              </button>
            </div>
            <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-3 shadow-inner">
              <pre className="text-[10.5px] font-mono text-zinc-200 whitespace-pre-wrap break-all select-all">
                {log.raw_user_agent || log.user_agent || "Unavailable"}
              </pre>
            </div>
          </div>

          {log.latitude !== null && log.longitude !== null ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  GPS Pin
                </span>
                <a
                  href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-0.5 rounded-full bg-white/85 border border-white text-[9.5px] font-black uppercase tracking-wider text-emerald-700 hover:bg-white"
                >
                  Open in Maps
                </a>
              </div>
              <iframe
                title="Visitor GPS location"
                src={`https://maps.google.com/maps?q=${log.latitude},${log.longitude}&z=13&output=embed`}
                className="w-full h-48 rounded-2xl border-2 border-white shadow-md"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}