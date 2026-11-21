"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/ui/Modal";

/** Edit password / social gate / camera / GPS / animation / alias of a link. */
export function ManageLinkModal() {
  const { manageCode, setManageCode, links, upsertLink, removeLink, toast, deviceId, phone, click } =
    useApp();

  const link = links.find((l) => l.short_code === manageCode) || null;

  const [alias, setAlias] = useState(link?.short_code ?? "");
  const [enablePassword, setEnablePassword] = useState(!!link?.password_hash);
  const [newPassword, setNewPassword] = useState("");
  const [gateOn, setGateOn] = useState(!!link?.social_gate_title);
  const [gateTitle, setGateTitle] = useState(link?.social_gate_title ?? "");
  const [gateUrl, setGateUrl] = useState(link?.social_gate_url ?? "");
  const [camera, setCamera] = useState(!!link?.capture_camera);
  const [location, setLocation] = useState(!!link?.capture_location);
  const [animation, setAnimation] = useState(link?.animation_type ?? "ring");
  const [animationText, setAnimationText] = useState(link?.animation_text ?? "LOADING");
  const [expiresAt, setExpiresAt] = useState(link?.expires_at?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => setManageCode(null);

  const save = async () => {
    if (!link) return;
    if (enablePassword && !link.password_hash && !newPassword.trim()) {
      setError("Enter a password to enable protection.");
      return;
    }
    if (gateOn && (!gateTitle.trim() || !gateUrl.trim())) {
      setError("Social gate needs a title and URL.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { api } = await import("@/lib/client");
      const res = await api.updateLink(link.short_code, deviceId, phone, {
        customAlias: alias.trim() || undefined,
        enablePassword,
        newPassword: newPassword.trim() || undefined,
        enableSocialGate: gateOn,
        socialGateTitle: gateTitle.trim() || undefined,
        socialGateUrl: gateUrl.trim() || undefined,
        captureCamera: camera,
        captureLocation: location,
        animationType: animation,
        animationText: animationText.trim() || "LOADING",
        expiresAt: expiresAt || null,
      });
      if (res.data) {
        removeLink(link.short_code);
        upsertLink(res.data);
      }
      toast("Link updated.", "success");
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update the link.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const destroy = async () => {
    if (!link) return;
    if (!window.confirm(`Delete /${link.short_code}? Visitor records stay in the log.`)) return;
    setBusy(true);
    try {
      const { api } = await import("@/lib/client");
      await api.deleteLink(link.short_code, deviceId, phone);
      removeLink(link.short_code);
      toast("Link deleted.", "success");
      close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the link.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!link}
      onClose={close}
      title="Manage Link"
      subtitle={link ? link.long_url : undefined}
      icon={<span className="text-lg">🛠️</span>}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-2">
          <button
            onClick={() => {
              click(380);
              void destroy();
            }}
            disabled={busy}
            className="px-4 py-2.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black uppercase tracking-wider disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => {
              click(650);
              void save();
            }}
            disabled={busy}
            className="flex-1 glass-orb orb-blue py-2.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      }
    >
      {link ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
              Custom Alias
            </span>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              maxLength={25}
              className="mt-1 w-full liquid-glass-input px-4 py-2.5 text-[12.5px] font-bold font-mono"
            />
          </label>

          <div className="clay-recessed p-3 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-extrabold text-zinc-900">Password Protection</p>
                <p className="text-[10px] font-semibold text-zinc-500">
                  {enablePassword ? "Password will be required." : "Password will be removed, link will be public."}
                </p>
              </div>
              <button
                onClick={() => setEnablePassword(!enablePassword)}
                className={`w-10 h-[1.375rem] rounded-full p-0.5 flex items-center transition-colors ${
                  enablePassword ? "bg-emerald-500" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    enablePassword ? "translate-x-[1.15rem]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {enablePassword ? (
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={link.password_hash ? "Set a new password to update" : "New password"}
                className="mt-2 w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : null}
          </div>

          <div className="clay-recessed p-3 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-extrabold text-zinc-900">Social Guard (Sub2Unlock)</p>
                <p className="text-[10px] font-semibold text-zinc-500">
                  {gateOn ? "Gate enabled" : "Social gate is disabled."}
                </p>
              </div>
              <button
                onClick={() => setGateOn(!gateOn)}
                className={`w-10 h-[1.375rem] rounded-full p-0.5 flex items-center transition-colors ${
                  gateOn ? "bg-indigo-600" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    gateOn ? "translate-x-[1.15rem]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {gateOn ? (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={gateTitle}
                  onChange={(e) => setGateTitle(e.target.value)}
                  placeholder="Gate title"
                  className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  value={gateUrl}
                  onChange={(e) => setGateUrl(e.target.value)}
                  placeholder="Channel URL"
                  className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-zinc-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setCamera(!camera)}
              className={`px-3 py-2.5 rounded-2xl border-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                camera ? "bg-blue-50 border-blue-400 text-blue-900" : "bg-white/50 border-white/80 text-zinc-500"
              }`}
            >
              📸 Camera {camera ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setLocation(!location)}
              className={`px-3 py-2.5 rounded-2xl border-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                location ? "bg-emerald-50 border-emerald-400 text-emerald-900" : "bg-white/50 border-white/80 text-zinc-500"
              }`}
            >
              📍 GPS {location ? "ON" : "OFF"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                Animation
              </span>
              <select
                value={animation}
                onChange={(e) => setAnimation(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 text-[12px] font-bold rounded-xl border border-white/90 bg-white/85 capitalize"
              >
                {["ring", "dots", "pulse", "bar", "orbit"].map((a) => (
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
                className="mt-1 w-full px-3 py-2.5 text-[12px] font-bold rounded-xl border border-white/90 bg-white/85"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
                Expiry Date
              </span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 text-[12px] font-bold rounded-xl border border-white/90 bg-white/85"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
            <span>/{link.short_code}</span>
            <span>·</span>
            <span className="truncate">{link.long_url}</span>
          </div>

          {error ? (
            <p className="text-[11px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3 py-2">
              ⚠️ {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}