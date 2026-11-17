"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
    setApiHubOpen,
    setExportOpen,
    setTab,
    click,
    refreshLinks,
    toast,
    phone,
  } = useApp();
  const [syncOpen, setSyncOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const brandTail = branding.brandName.split(/\s+/).slice(1).join(" ") || branding.brandName;

  useEffect(() => {
    if (!quickOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [quickOpen]);

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

        {/* Compact reference header for phones: plan, HTML export and menu. */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {user ? (
            <button
              onClick={() => {
                click(680);
                setCouponOpen(true);
              }}
              className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-[8.5px] font-black uppercase tracking-tight max-w-[78px] truncate"
              aria-label={`Account ${user.name}, open plan and coupon details`}
            >
              {user.plan === "premium" ? "👑 VIP" : `${user.remainingToday}/${user.dailyLimit} FREE`}
            </button>
          ) : (
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-[8.5px] font-black uppercase tracking-tight whitespace-nowrap">
              Unlimited Free
            </span>
          )}
          <button
            onClick={() => {
              click(700);
              setExportOpen(true);
            }}
            className="glass-orb orb-green h-7 px-2 text-[8.5px] font-black text-white whitespace-nowrap"
            title="Direct Download HTML"
          >
            ↓ Direct HTML
          </button>
          <button
            type="button"
            onClick={() => {
              click(580);
              setQuickOpen(true);
            }}
            aria-expanded={quickOpen}
            aria-label="Open Quick Actions Hub"
            className="glass-orb orb-champagne w-7 h-7 text-zinc-900"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {quickOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[3px]"
                onClick={() => setQuickOpen(false)}
                aria-label="Close Quick Actions Hub"
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Quick Actions Hub"
                className="relative z-10 w-[min(92vw,25rem)] rounded-[24px] border-2 border-white bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl animate-slide-up"
              >
                <div className="flex items-center gap-2.5 mb-3 px-0.5">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white flex items-center justify-center text-lg shadow-sm">▦</span>
                  <span className="flex-1 min-w-0">
                    <b className="block text-[13px] font-black text-zinc-900">Quick Actions Hub</b>
                    <small className="block text-[10px] font-semibold text-zinc-500">Control Center &amp; Shortcuts</small>
                  </span>
                  <button type="button" onClick={() => setQuickOpen(false)} className="glass-orb orb-clear w-8 h-8 text-zinc-700" aria-label="Close menu">×</button>
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={toggleSoundOn}
                    aria-pressed={soundOn}
                    className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white/80 border border-zinc-200/80 text-left"
                  >
                    <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">◖))</span>
                    <span className="flex-1"><b className="block text-[11px] font-black text-zinc-900">Tactile Bubble Audio</b><small className="text-[9.5px] text-zinc-500">Sound Effects {soundOn ? "Enabled" : "Muted"}</small></span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black">{soundOn ? "ON" : "OFF"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setQuickOpen(false); setSyncOpen(true); click(660); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white/80 border border-zinc-200/80 text-left"
                  >
                    <span className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center">▣</span>
                    <span className="flex-1"><b className="block text-[11px] font-black text-zinc-900">Sync Device Identity</b><small className="text-[9.5px] text-zinc-500">Bind phone or Telegram ID</small></span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black">Sync</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setQuickOpen(false); click(660); user ? setCouponOpen(true) : openAuth("login"); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white/80 border border-zinc-200/80 text-left"
                  >
                    <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">▣</span>
                    <span className="flex-1"><b className="block text-[11px] font-black text-zinc-900">Redeem Coupon Code</b><small className="text-[9.5px] text-zinc-500">Unlock Pro &amp; VIP Plans</small></span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black">Promo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setQuickOpen(false); click(640); setApiHubOpen(true); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white/80 border border-zinc-200/80 text-left"
                  >
                    <span className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center">‹›</span>
                    <span className="flex-1"><b className="block text-[11px] font-black text-zinc-900">Developer API Hub</b><small className="text-[9.5px] text-zinc-500">REST API, curl &amp; Telegram SDK</small></span>
                    <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[9px] font-black">API</span>
                  </button>

                  {user ? (
                    <button
                      type="button"
                      onClick={() => { setQuickOpen(false); click(500); void logout(); }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white/80 border border-zinc-200/80 text-left"
                    >
                      <span className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center">↪</span>
                      <span className="flex-1"><b className="block text-[11px] font-black text-zinc-900">Sign Out</b><small className="text-[9.5px] text-zinc-500">Sign out of @{user.name}</small></span>
                    </button>
                  ) : null}
                </div>

                <a
                  href="https://www.whatsapp.com/channel/0029VbBTSK1EquiWrUt5uV1I"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => click(700)}
                  className="mt-2.5 w-full min-h-8 rounded-xl bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center"
                >
                  ◉ &nbsp; Join Official WhatsApp Channel
                </a>
              </section>
            </div>,
            document.body,
          )
        : null}

      <SyncIdentityModal open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}
