"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AvatarOrb, CartoonName } from "@/components/Sidebar";
import { Modal } from "@/components/ui/Modal";

/** "Sync Device Identity" dialog — links links to a phone number (no OTP). */
function SyncIdentityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { phone, setPhone, deviceId, toast, refreshLinks } = useApp();
  const [value, setValue] = useState(phone);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link your generated short URLs"
      subtitle="No OTP needed — the number is only a retrieval key."
      icon={<span className="text-lg">📱</span>}
      maxWidth="max-w-md"
      footer={
        <button
          onClick={() => {
            const cleaned = value.replace(/[^\d+]/g, "").slice(0, 20);
            setPhone(cleaned);
            onClose();
            toast(
              cleaned
                ? "Device identity synced. Your history now follows this number."
                : "Phone number cleared.",
              "success",
            );
            void refreshLinks();
          }}
          className="w-full glass-orb orb-blue py-3 font-black text-sm uppercase tracking-wide"
        >
          Identify / Sync
        </button>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
            Phone Number
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="+92 347 8936242"
            className="mt-1 w-full liquid-glass-input px-4 py-2.5 text-sm font-bold"
          />
        </label>
        <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
          Enter your phone number to link your generated short URLs. If you clear data or use a bot,
          entering this number will recover your history. No OTP needed.
        </p>
        <div className="clay-recessed p-3 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
            Current Device ID
          </p>
          <p className="text-[11px] font-mono text-zinc-800 break-all mt-0.5">
            {deviceId || "—"}
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function Header() {
  const {
    branding,
    soundOn,
    toggleSoundOn,
    user,
    setUser,
    openAuth,
    setCouponOpen,
    setTab,
    click,
    refreshLinks,
    toast,
    phone,
  } = useApp();
  const [syncOpen, setSyncOpen] = useState(false);
  const brandTail = branding.brandName.split(/\s+/).slice(1).join(" ") || branding.brandName;

  const logout = async () => {
    const { api, clearUserToken } = await import("@/lib/client");
    try {
      await api.logout();
    } catch {
      /* the local token is cleared regardless */
    }
    clearUserToken();
    setUser(null);
    void refreshLinks();
    toast("Signed out.", "info");
  };

  return (
    <>
      <header className="liquid-glass-box sticky top-1 sm:top-2.5 z-40 rounded-2xl sm:rounded-full px-2.5 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 shadow-md w-full min-w-0 backdrop-blur-xl bg-white/90">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <AvatarOrb
            onClick={() => {
              click(560);
              setTab("analytics");
            }}
          />
          <CartoonName />
          <div className="min-w-0 hidden md:block">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] sm:text-[14px] font-black tracking-tight text-zinc-900 uppercase truncate max-w-[10rem]">
                {brandTail}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-500/40 text-[9px] font-extrabold text-emerald-950 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                <span>3D OS</span>
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0 z-10">
          <button
            onClick={toggleSoundOn}
            className={`glass-orb w-8 h-8 sm:w-9 sm:h-9 text-xs transition-transform active:scale-90 shrink-0 ${
              soundOn ? "orb-clear" : "orb-champagne opacity-70"
            }`}
            title={soundOn ? "Mute Tactile Bubble Audio" : "Enable Tactile Bubble Audio"}
            aria-pressed={soundOn}
          >
            {soundOn ? (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-900" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 010 7" /><path d="M18 6a9 9 0 010 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M11 5 6 9H3v6h3l5 4z" /><path d="M22 9l-6 6M16 9l6 6" />
              </svg>
            )}
          </button>

          <button
            onClick={() => {
              click(660);
              setSyncOpen(true);
            }}
            className="glass-orb orb-champagne w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-zinc-900 active:scale-95 transition-transform shrink-0"
            title={phone ? `Synced: ${phone}` : "Sync Device Identity"}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" />
            </svg>
          </button>

          {user ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  click(680);
                  setCouponOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full liquid-glass-input shadow-xs shrink-0 cursor-pointer hover:bg-white/60 active:scale-95 transition-all select-none"
                title="View Subscription & Redeem Coupons"
              >
                <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[10px] sm:text-xs font-black text-zinc-900 truncate max-w-[80px] sm:max-w-[110px]">
                  @{user.name}
                </span>
                {user.plan === "premium" ? (
                  <span className="px-1.5 rounded-full bg-amber-400 text-amber-950 text-[8.5px] font-black shadow-xs">
                    👑 VIP
                  </span>
                ) : (
                  <span className="px-1.5 rounded-full bg-emerald-100 text-emerald-900 text-[8.5px] font-black border border-emerald-300 shadow-xs">
                    {user.remainingToday}/{user.dailyLimit}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  click(500);
                  void logout();
                }}
                className="px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-extrabold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
                title="Sign Out"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black flex items-center gap-1 border shadow-xs select-none shrink-0 bg-emerald-50 text-emerald-800 border-emerald-200"
                title="Guest mode: Unlimited free links!"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Unlimited Free</span>
              </div>
              <button
                onClick={() => {
                  click(640);
                  openAuth("login");
                }}
                className="glass-orb orb-champagne px-2.5 sm:px-3 py-1.5 text-[10.5px] sm:text-xs font-black text-zinc-900 active:scale-95 transition-transform shrink-0"
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        {/* compact controls for phones / tablets */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <button
            onClick={toggleSoundOn}
            className={`glass-orb w-7 h-7 ${soundOn ? "orb-clear" : "orb-champagne opacity-70"}`}
            aria-label="Toggle sound"
          >
            <span className="text-[10px]">{soundOn ? "🔊" : "🔇"}</span>
          </button>
          <button
            onClick={() => {
              click(660);
              setSyncOpen(true);
            }}
            className="glass-orb orb-champagne w-7 h-7"
            aria-label="Sync device identity"
          >
            <span className="text-[10px]">📱</span>
          </button>
          {user ? (
            <button
              onClick={() => {
                click(680);
                setCouponOpen(true);
              }}
              className="flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full liquid-glass-input"
              aria-label="Account"
            >
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-[8.5px] font-black">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-[9px] font-black text-zinc-800">
                {user.plan === "premium" ? "👑" : `${user.remainingToday}`}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                click(640);
                openAuth("login");
              }}
              className="glass-orb orb-champagne px-2 py-1 text-[9.5px] font-black text-zinc-900"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <SyncIdentityModal open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}