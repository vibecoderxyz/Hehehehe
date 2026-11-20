"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { BottomDock } from "@/components/BottomDock";
import { ShortenPanel } from "@/components/ShortenPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { RecentPanel } from "@/components/RecentPanel";
import { MediaPanel } from "@/components/MediaPanel";
import { ManageLinkModal } from "@/components/ManageLinkModal";
import { DeviceInfoModal } from "@/components/DeviceInfoModal";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ApiHubModal } from "@/components/ApiHubModal";
import { ExportHtmlModal } from "@/components/ExportHtmlModal";
import { UserAuthModal } from "@/components/UserAuthModal";
import { CouponModal } from "@/components/CouponModal";
import { Toaster } from "@/components/ui/Toaster";
import type { Tab } from "@/components/AppProvider";

const PANEL_META: Record<Tab, { title: string; sub: string }> = {
  create: {
    title: "Shorten & Generate Smart Links",
    sub: "Add gate options, capture rules, and a custom alias before generating.",
  },
  analytics: {
    title: "Opt-in Visitor & Device Analytics",
    sub: "Only opted-in visitors share analytics; camera and GPS are separate opt-ins.",
  },
  media: {
    title: "Webcam & Media Capture Feed",
    sub: "Grab a frame from this device or convert and compress an image offline.",
  },
  recent: {
    title: "Recent Links History",
    sub: "Every link this device or account owns, with Intel, edit and delete actions.",
  },
};

/** Ambient refraction blobs that give the board its 3D liquid-glass depth. */
function AmbientBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className="ambient-refraction-blob"
        style={{
          width: "22rem",
          height: "22rem",
          top: "-4rem",
          left: "-6rem",
          background: "radial-gradient(circle, #7dd3fc 0%, #a78bfa00 70%)",
          opacity: 0.5,
        }}
      />
      <span
        className="ambient-refraction-blob"
        style={{
          width: "26rem",
          height: "26rem",
          top: "18%",
          right: "-8rem",
          background: "radial-gradient(circle, #fda4af 0%, #fbcfe800 70%)",
          opacity: 0.45,
        }}
      />
      <span
        className="ambient-refraction-blob"
        style={{
          width: "24rem",
          height: "24rem",
          bottom: "-6rem",
          left: "24%",
          background: "radial-gradient(circle, #fcd34d 0%, #fde68a00 70%)",
          opacity: 0.4,
        }}
      />
    </div>
  );
}

/**
 * Quick-actions sheet: the reference build exposes the secondary destinations
 * (API hub, coupon, export, media, recent) through a floating menu on phones.
 */
function QuickActionsMenu() {
  const { tab, setTab, setApiHubOpen, setExportOpen, setCouponOpen, openAuth, user, click } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const rows: { label: string; icon: string; run: () => void }[] = [
    {
      label: "Shorten Link",
      icon: "🔗",
      run: () => setTab("create"),
    },
    {
      label: "Live Analytics",
      icon: "📊",
      run: () => setTab("analytics"),
    },
    {
      label: "Media Studio",
      icon: "🎥",
      run: () => setTab("media"),
    },
    {
      label: "Recent Links",
      icon: "🕘",
      run: () => setTab("recent"),
    },
    {
      label: "Live API Hub",
      icon: "🧩",
      run: () => setApiHubOpen(true),
    },
    {
      label: "Redeem Coupon",
      icon: "🎟️",
      run: () => (user ? setCouponOpen(true) : openAuth("login")),
    },
    {
      label: "Direct Download HTML",
      icon: "📦",
      run: () => setExportOpen(true),
    },
  ];

  return (
    <div ref={wrapRef} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => {
          click(580);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label="Toggle Quick Navigation Menu"
        className={`glass-orb w-9 h-9 flex items-center justify-center active:scale-90 transition-all ${
          open ? "orb-blue text-white ring-2 ring-blue-400/70" : "orb-champagne text-zinc-900"
        }`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-60 clay-board rounded-2xl p-2 shadow-2xl animate-slide-up">
          {rows.map((row) => (
            <button
              key={row.label}
              onClick={() => {
                click(620);
                setOpen(false);
                row.run();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[12px] font-bold transition-colors ${
                tab === "create" && row.label === "Shorten Link"
                  ? "bg-white/80 text-zinc-900"
                  : "text-zinc-700 hover:bg-white/70"
              }`}
            >
              <span className="text-sm leading-none">{row.icon}</span>
              <span>{row.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** PWA install chip — appears only once the browser fires beforeinstallprompt. */
function InstallChip() {
  const [promptEvent, setPromptEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as unknown as { prompt: () => Promise<void> });
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !promptEvent) return null;

  return (
    <button
      onClick={() => {
        void promptEvent.prompt();
        setPromptEvent(null);
      }}
      className="fixed left-3 bottom-24 lg:bottom-5 z-[60] clay-small-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-800 flex items-center gap-1.5 shadow-lg active:scale-95"
      title="Install this dashboard as an app"
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
      <span>Install app</span>
    </button>
  );
}

/**
 * Inline "privacy model" disclosure. Rendered as a small glass popover instead
 * of a native alert so it matches the rest of the design system.
 */
function PrivacyNote() {
  const { click } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          click(700);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="underline underline-offset-2 hover:text-zinc-800 font-bold"
      >
        privacy model
      </button>
      {open ? (
        <span
          role="dialog"
          aria-label="Privacy model"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 block w-[min(84vw,20rem)] clay-board rounded-2xl p-3 text-left shadow-2xl animate-slide-up"
        >
          <span className="block text-[10px] font-black uppercase tracking-wider text-zinc-900 mb-1">
            🔒 Privacy model
          </span>
          <span className="block text-[10.5px] font-semibold text-zinc-600 leading-relaxed">
            Analytics and device data are sent only after the visitor opts in. Camera and GPS each
            require separate opt-in and browser permission; visitors may continue without sharing.
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function ControlCenter() {
  const { tab } = useApp();
  const meta = PANEL_META[tab];

  return (
    <div className="relative min-h-dvh">
      <AmbientBlobs />

      <div className="clay-board-outer relative w-full max-w-[1400px] min-w-0 mx-auto p-2.5 sm:p-5 lg:p-6 flex flex-col lg:flex-row gap-3 sm:gap-5 safe-bottom-padding lg:pb-6">
        <Sidebar />

        <main className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-4">
          <Header />

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                🚀 3D LIQUID GLASS CONTROL CENTER
              </p>
              <h1 className="text-[15px] sm:text-[19px] font-black text-zinc-900 tracking-tight leading-tight truncate">
                {meta.title}
              </h1>
              <p className="text-[10.5px] sm:text-[11.5px] font-semibold text-zinc-500 leading-snug">
                {meta.sub}
              </p>
            </div>
            <QuickActionsMenu />
          </div>

          <div key={tab} className="animate-in">
            {tab === "create" ? <ShortenPanel /> : null}
            {tab === "analytics" ? <AnalyticsPanel /> : null}
            {tab === "media" ? <MediaPanel /> : null}
            {tab === "recent" ? <RecentPanel /> : null}
          </div>

          <footer className="mt-auto pt-2 pb-1 text-center">
            <p className="text-[9.5px] font-semibold text-zinc-500">
              <span className="font-black text-zinc-700">Supashort</span> · 3D Liquid Glass OS ·{" "}
              <PrivacyNote />
            </p>
          </footer>
        </main>
      </div>

      <BottomDock />
      <InstallChip />

      <ManageLinkModal />
      <DeviceInfoModal />
      <ImageLightbox />
      <ApiHubModal />
      <ExportHtmlModal />
      <UserAuthModal />
      <CouponModal />
      <Toaster />
    </div>
  );
}
