"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/client";

function planBadge(user: NonNullable<ReturnType<typeof useApp>["user"]>) {
  if (user.plan === "premium") {
    return (
      <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-amber-950 font-black text-[11px] shadow-xs">
        👑 VIP
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold text-[11px]">
      Standard Free Account
    </span>
  );
}

/** Coupon redemption + plan / quota summary. */
export function CouponModal() {
  const { couponOpen, setCouponOpen, user, setUser, toast, click, refreshLinks, openAuth } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setCouponOpen(false);
    setError("");
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    click(720);
    setBusy(true);
    try {
      const res = await api.redeemCoupon(code.trim().toUpperCase());
      setUser(res.user);
      await refreshLinks();
      setCode("");
      toast(res.message || "Coupon redeemed!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That coupon could not be redeemed.");
    } finally {
      setBusy(false);
    }
  };

  const expires = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const daysLeft =
    expires && !Number.isNaN(expires.getTime())
      ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000))
      : null;
  const used = user ? user.dailyLimit - user.remainingToday : 0;
  const pct = user ? Math.min(100, Math.round((used / Math.max(1, user.dailyLimit)) * 100)) : 0;

  return (
    <Modal
      open={couponOpen}
      onClose={close}
      title="Redeem Coupon Code"
      subtitle="Activate or extend your Pro or VIP plan instantly."
      icon={<span className="text-lg">🎟️</span>}
      maxWidth="max-w-md"
    >
      {!user ? (
        <div className="space-y-3">
          <div className="clay-recessed rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2 opacity-70">🔐</p>
            <p className="text-[13px] font-black text-zinc-900">Sign in to redeem coupons</p>
            <p className="text-[11px] font-semibold text-zinc-600 mt-1">
              Coupons are tied to your account so your plan follows you everywhere.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                click(660);
                close();
                openAuth("register");
              }}
              className="flex-1 glass-orb orb-blue py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95"
            >
              Create Free Account
            </button>
            <button
              onClick={() => {
                click(550);
                close();
                openAuth("login");
              }}
              className="flex-1 glass-orb orb-champagne py-2.5 text-[11px] font-black uppercase tracking-wider text-zinc-900 active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="clay-recessed rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                Plan Status
              </span>
              {planBadge(user)}
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-zinc-600">Today&apos;s Daily Quota</span>
              <span className="font-mono font-black text-zinc-900">
                {user.plan === "premium"
                  ? `Unlimited (${used} used)`
                  : `${used} / ${user.dailyLimit}`}
              </span>
            </div>

            {user.plan !== "premium" ? (
              <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden p-0.5 border border-white">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 100 ? "bg-rose-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}

            <p className="text-[10px] text-zinc-500 italic">
              Daily limits reset automatically at 00:00 UTC midnight.
            </p>

            {expires && daysLeft !== null ? (
              <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-xl border border-white">
                <span className="text-[11px] font-medium text-zinc-600">Valid Until:</span>
                <span className="text-[11px] font-mono font-bold text-zinc-900">
                  {expires.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {daysLeft > 3650 ? " · 🌟 Lifetime" : ` · ${daysLeft}d left`}
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-white/85 rounded-xl p-2.5 text-center border border-white">
                <span className="text-[9.5px] font-bold text-zinc-500 uppercase block">
                  Total Links Created
                </span>
                <span className="text-base font-black text-zinc-900 font-mono">{user.totalUsed}</span>
              </div>
              <div className="bg-white/85 rounded-xl p-2.5 text-center border border-white">
                <span className="text-[9.5px] font-bold text-zinc-500 uppercase block">
                  Last Coupon Used
                </span>
                <span
                  className="text-[11px] font-black text-indigo-700 font-mono truncate block mt-0.5"
                  title={user.lastCouponUsed || "None"}
                >
                  {user.lastCouponUsed || "None"}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={redeem} className="space-y-2.5">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                Redeem Promo / Coupon Code
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VIP-2026 or PRO-30D"
                  maxLength={40}
                  className="flex-1 liquid-glass-input px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider"
                />
                <button
                  type="submit"
                  disabled={busy || !code.trim()}
                  className="glass-orb orb-amber px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-zinc-950 active:scale-95 disabled:opacity-45"
                >
                  {busy ? "…" : "Redeem"}
                </button>
              </div>
            </label>

            {error ? (
              <p className="text-[11px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3 py-2">
                ⚠️ {error}
              </p>
            ) : null}

            <p className="text-[10.5px] font-semibold text-zinc-600 leading-relaxed">
              Got a code from Admin? Activate or extend your Pro or VIP plan instantly.
            </p>
          </form>
        </div>
      )}
    </Modal>
  );
}