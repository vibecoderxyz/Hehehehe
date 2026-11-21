"use client";

import Image from "next/image";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { shortUrlFor } from "@/lib/client";
import { SocialIcon } from "@/components/ui/SocialIcon";

const LETTERS = ["S", "A", "Q", "I", "B"];
const LETTER_COLORS = [
  "text-[#2e45b8]",
  "text-[#e03c28]",
  "text-[#f5ecd7]",
  "text-[#f2b726]",
  "text-[#278c68]",
];
const LETTER_TILT = ["-rotate-6", "rotate-3", "-rotate-3", "rotate-6", "-rotate-6"];

export function CartoonName({ size = "lg" }: { size?: "sm" | "lg" }) {
  const scale =
    size === "lg" ? "text-[17px] xs:text-[19px] sm:text-[26px]" : "text-[16px] sm:text-[20px]";
  return (
    <div className="flex items-center gap-0.5 select-none shrink-0" aria-label="Saqib">
      {LETTERS.map((ch, i) => (
        <span
          key={i}
          className={`cartoon-letter ${scale} ${LETTER_COLORS[i]} ${LETTER_TILT[i]} ${
            i > 0 ? "-ml-0.5" : ""
          }`}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

export function AvatarOrb({ onClick }: { onClick?: () => void }) {
  const { branding } = useApp();
  const [broken, setBroken] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${branding.displayName} — ${branding.brandName}`}
      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full saqib-avatar-crop border-2 border-white ring-2 ring-white/70 shadow-sm shrink-0 lg:hidden cursor-pointer active:scale-90 transition-transform overflow-hidden bg-slate-900/10 relative"
    >
      {broken ? (
        <span className="w-full h-full flex items-center justify-center text-[13px] font-black text-indigo-700 bg-indigo-50">
          {branding.displayName.slice(0, 1)}
        </span>
      ) : (
        <Image
          src={branding.avatarUrl}
          alt={branding.displayName}
          width={36}
          height={36}
          className="w-full h-full object-cover object-[50%_18%]"
          unoptimized
          onError={() => setBroken(true)}
        />
      )}
    </button>
  );
}

export function PromoCard({ compact = false }: { compact?: boolean }) {
  const { branding, click } = useApp();
  return (
    <div className={`clay-promo-card ${compact ? "p-3" : "p-3.5"} text-center flex flex-col items-center`}>
      <h3 className="text-zinc-900 font-black text-[14px]">{branding.brandName}</h3>
      <p className="text-zinc-600 text-[11px] mt-0.5 leading-snug font-medium">
        Where Creativity Meets
        <br />
        <span className="italic text-blue-600 font-bold">Technology &amp; AI!</span>
      </p>
      <a
        href="https://wa.me/923478936242"
        target="_blank"
        rel="noreferrer"
        onClick={() => click(720)}
        className="glass-orb orb-green mt-3 w-full py-2.5 px-3 text-[12px] font-bold flex items-center justify-center gap-2 text-white active:scale-95 transition-transform shadow-md"
      >
        <SocialIcon platform="whatsapp" colored={false} className="w-4 h-4 shrink-0" />
        <span>Connect on WhatsApp</span>
      </a>
    </div>
  );
}

/** Sidebar list of the 6 most recent links with quick actions. */
function RecentList() {
  const { links, click, setTab, setSelected, setManageCode, origin, toast } = useApp();

  const copy = async (code: string) => {
    const { copyText } = await import("@/lib/client");
    const ok = await copyText(shortUrlFor(code, origin));
    toast(ok ? "Short link copied!" : "Copy blocked by the browser", ok ? "success" : "error");
  };

  return (
    <div className="mt-5 pt-4 border-t border-zinc-300/40">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-extrabold text-zinc-800 uppercase tracking-wider">
          Recent Links
        </span>
        <span className="clay-small-pill px-2 py-0.5 text-[10px] font-mono-code font-bold text-zinc-900">
          {links.length}
        </span>
      </div>
      <div className="space-y-2 max-h-44 overflow-y-auto clay-scroll pr-1">
        {links.slice(0, 6).map((l) => (
          <div key={l.short_code} className="clay-recessed-dark p-2.5 rounded-xl text-left transition-all hover:bg-white/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 font-mono truncate">/{l.short_code}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    click(550);
                    setSelected(l);
                    setTab("analytics");
                  }}
                  className="text-zinc-500 hover:text-blue-600 transition-colors"
                  title="Analytics"
                  aria-label={`Analytics for ${l.short_code}`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 4-6" /></svg>
                </button>
                <button
                  onClick={() => {
                    click(600);
                    void copy(l.short_code);
                  }}
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                  title="Copy"
                  aria-label={`Copy ${l.short_code}`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></svg>
                </button>
                <button
                  onClick={() => {
                    click(650);
                    setManageCode(l.short_code);
                  }}
                  className="text-zinc-500 hover:text-indigo-600 transition-colors"
                  title="Edit"
                  aria-label={`Edit ${l.short_code}`}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                </button>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 truncate mt-0.5">{l.long_url}</p>
          </div>
        ))}
        {links.length === 0 ? (
          <p className="text-[11px] text-zinc-500 italic">No links generated yet</p>
        ) : null}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { tab, setTab, click, setApiHubOpen, setExportOpen, user, openAuth, setCouponOpen, branding } =
    useApp();

  const navItem = (
    key: "create" | "analytics" | "media",
    label: string,
    icon: React.ReactNode,
    freq: number,
  ) => (
    <button
      onClick={() => {
        click(freq);
        setTab(key);
      }}
      className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-[14px] font-bold transition-all ${
        tab === key ? "nav-pill-active" : "nav-pill-inactive"
      }`}
    >
      <span className="w-5 h-5 shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="hidden lg:flex flex-col w-[270px] shrink-0 clay-sidebar p-4 sticky top-2.5 max-h-[calc(100dvh-1.5rem)] overflow-y-auto clay-scroll">
      {/* avatar */}
      <div className="flex flex-col items-center text-center relative mb-3">
        <div className="relative">
          <div className="w-[86px] h-[86px] rounded-full saqib-avatar-crop border-[3px] border-white ring-2 ring-white/80 shadow-lg overflow-hidden bg-slate-900/10">
            <Image
              src={branding.avatarUrl}
              alt={branding.displayName}
              width={86}
              height={86}
              className="w-full h-full object-cover object-[50%_18%]"
              unoptimized
            />
          </div>
          <span className="float-badge absolute -top-1 -right-2 glass-orb orb-amber w-7 h-7 text-[13px]" aria-hidden>
            ⚡
          </span>
          <span
            className="float-badge absolute -bottom-1 -left-2 glass-orb orb-purple w-6 h-6 text-[11px]"
            style={{ animationDelay: "1.1s" }}
            aria-hidden
          >
            ✦
          </span>
        </div>
        <div className="mt-2.5">
          <CartoonName size="sm" />
        </div>
        <p className="text-[10.5px] font-bold text-zinc-500 mt-1">{branding.displayName}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-500/40 text-[9px] font-extrabold text-emerald-950">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
          3D Liquid Glass OS
        </span>
      </div>

      {/* nav */}
      <nav className="space-y-2 mt-1">
        {navItem(
          "create",
          "Shorten Link",
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7L11 6" /><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7L13 18" /></svg>,
          520,
        )}
        {navItem(
          "analytics",
          "Live Analytics",
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 4-6" /></svg>,
          560,
        )}
        {navItem(
          "media",
          "Media Studio",
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="6" width="14" height="12" rx="3" /><path d="M16 10l6-3v10l-6-3z" /></svg>,
          600,
        )}
        <button
          onClick={() => {
            click(640);
            setApiHubOpen(true);
          }}
          className="nav-pill-inactive w-full flex items-center justify-between px-4 py-2.5 text-[14px] font-bold"
        >
          <span className="flex items-center gap-3.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 3H7a3 3 0 00-3 3v4l-2 2 2 2v4a3 3 0 003 3h1" /><path d="M16 3h1a3 3 0 013 3v4l2 2-2 2v4a3 3 0 01-3 3h-1" /></svg>
            <span>Live API Hub</span>
          </span>
          {!user ? (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-900 border border-amber-500/30 text-[9px] font-extrabold flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              PRO
            </span>
          ) : null}
        </button>

        <button
          onClick={() => {
            click(660);
            if (user) setCouponOpen(true);
            else openAuth("login");
          }}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[14px] font-bold rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border border-amber-500/40 hover:bg-amber-500/25 text-amber-950 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <span className="flex items-center gap-3.5">
            <span className="text-lg leading-none">🎟️</span>
            <span className="font-black">Redeem Coupon</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-amber-950 text-[9.5px] font-black uppercase tracking-wider shadow-xs">
            PRO / VIP
          </span>
        </button>

        <button
          onClick={() => {
            click(700);
            setExportOpen(true);
          }}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[14px] font-bold rounded-full bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-emerald-500/25 border border-emerald-500/40 hover:bg-emerald-500/35 text-emerald-950 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        >
          <span className="flex items-center gap-3.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
            <span className="font-black">Direct Download HTML</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs">
            1-CLICK
          </span>
        </button>
      </nav>

      <RecentList />
      <PromoCard />
    </aside>
  );
}