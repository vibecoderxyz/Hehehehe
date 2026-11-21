"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { copyText } from "@/lib/client";
import { generateStandaloneHtml } from "@/lib/standalone";

type Tier = "free" | "pro" | "vip";

const TIERS: { id: Tier; badge: string; label: string; blurb: string }[] = [
  { id: "free", badge: "⚪", label: "Free Minimal", blurb: "Light, clean, centred card" },
  { id: "pro", badge: "💎", label: "Pro Dark", blurb: "Cyber-glass dark console" },
  { id: "vip", badge: "👑", label: "VIP 3D Clay", blurb: "Liquid clay, full 3D depth" },
];

/**
 * Standalone HTML export. Generates a single self-hosted index.html in the
 * chosen visual tier, wired to this deployment's /api/shorten endpoint.
 */
export function ExportHtmlModal() {
  const { exportOpen, setExportOpen, branding, origin, toast, click } = useApp();

  const [developerName, setDeveloperName] = useState("Muhammad Saqib");
  const [channelUrl, setChannelUrl] = useState("https://youtube.com/@saqibvisuals");
  const [brandName, setBrandName] = useState(branding.brandName || "Saqib Visuals");
  const [tier, setTier] = useState<Tier>("vip");
  const [copied, setCopied] = useState(false);

  const close = () => {
    setExportOpen(false);
    setCopied(false);
  };

  /* Generating the standalone document is not cheap (three themes + a client
     script), so build it once per input change instead of on every render. */
  const html = useMemo(
    () =>
      generateStandaloneHtml({
        developerName: developerName.trim() || "Muhammad Saqib",
        channelUrl: channelUrl.trim() || "https://youtube.com/@saqibvisuals",
        brandName: brandName.trim() || "Saqib Visuals",
        apiEndpoint: origin,
        tier,
      }),
    [developerName, channelUrl, brandName, origin, tier],
  );

  const byteSize = useMemo(
    () => new TextEncoder().encode(html).length,
    [html],
  );

  const download = () => {
    click(720);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a tick to start the download before revoking.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Standalone HTML downloaded.", "success");
  };

  const copy = async () => {
    click(700);
    const ok = await copyText(html);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
    toast(ok ? "HTML Code Copied!" : "Copy blocked by the browser", ok ? "success" : "error");
  };

  return (
    <Modal
      open={exportOpen}
      onClose={close}
      title="Direct Download HTML"
      subtitle="Deployable index.html self-hosted source"
      icon={<span className="text-lg">📦</span>}
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => void copy()}
            className="flex-1 glass-orb orb-champagne py-3 text-[11px] font-black uppercase tracking-wider text-zinc-900 active:scale-95 flex items-center justify-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></svg>
            <span>{copied ? "Copied!" : "Copy HTML Code"}</span>
          </button>
          <button
            onClick={download}
            className="flex-1 glass-orb orb-green py-3 text-[11px] font-black uppercase tracking-wider text-white active:scale-95 flex items-center justify-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
            <span>⚡ Direct Download</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="clay-recessed rounded-2xl p-3">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-900 mb-0.5">
            Set Developer Name &amp; Channel Link
          </h3>
          <p className="text-[10.5px] font-semibold text-zinc-600 leading-snug">
            Branding is baked into the exported file — visitors see it on the landing card.
          </p>
        </div>

        <div className="space-y-2.5">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
              Developer / Creator Name
            </span>
            <input
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
              maxLength={60}
              className="mt-1 w-full liquid-glass-input px-3.5 py-2.5 text-[12.5px] font-bold"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
              Channel / Social URL
            </span>
            <input
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              maxLength={200}
              inputMode="url"
              className="mt-1 w-full liquid-glass-input px-3.5 py-2.5 text-[12.5px] font-bold"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
              Brand Name
            </span>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              maxLength={40}
              className="mt-1 w-full liquid-glass-input px-3.5 py-2.5 text-[12.5px] font-bold"
            />
          </label>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1.5">
            Template UI Design Tier:
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  click(620);
                  setTier(t.id);
                }}
                className={`rounded-xl p-2 text-center transition-all active:scale-95 border ${
                  tier === t.id
                    ? "bg-zinc-900 border-zinc-900 text-white shadow-md"
                    : "bg-white/70 border-white text-zinc-700 hover:bg-white"
                }`}
              >
                <span className="block text-base leading-none mb-1">{t.badge}</span>
                <span className="block text-[10px] font-black leading-tight">{t.label}</span>
                <span
                  className={`block text-[8.5px] font-semibold leading-tight mt-0.5 ${
                    tier === t.id ? "text-white/65" : "text-zinc-500"
                  }`}
                >
                  {t.blurb}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="clay-recessed rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-900">
              Customize HTML
            </h3>
            <button
              onClick={() => void copy()}
              className="clay-small-pill px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wider text-zinc-700 active:scale-95"
            >
              {copied ? "Copied!" : "Copy HTML Code"}
            </button>
          </div>
          <pre className="max-h-32 overflow-y-auto clay-scroll rounded-xl bg-zinc-950/90 border border-zinc-800 p-2.5 text-[9.5px] leading-snug font-mono text-zinc-300 whitespace-pre-wrap break-all">
            {html.slice(0, 1400)}
            {html.length > 1400 ? "\n…" : ""}
          </pre>
          <p className="mt-1.5 text-[9.5px] font-mono text-zinc-500">
            {byteSize.toLocaleString()} bytes · API: {origin}/api/shorten
          </p>
        </div>
      </div>
    </Modal>
  );
}