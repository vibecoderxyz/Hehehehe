"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { api, setUserToken } from "@/lib/client";

/**
 * Register / sign-in dialog. Registration creates a free account (5 links /
 * day); signing in restores an existing plan. Sessions are stateless HMAC
 * tokens issued by /api/user/auth.
 */
export function UserAuthModal() {
  const { authOpen, authMode, openAuth, closeAuth, setUser, toast, click, refreshLinks } = useApp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRegister = authMode === "register";

  /* Reset the form whenever the dialog is (re)opened. */
  useEffect(() => {
    if (!authOpen) return;
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }, [authOpen, authMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are both required.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for the password.");
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (isRegister && name.trim().length < 2) {
      setError("Pick a display name (2+ characters).");
      return;
    }

    click(720);
    setBusy(true);
    try {
      const res = isRegister
        ? await api.register(email.trim().toLowerCase(), password, name.trim())
        : await api.login(email.trim().toLowerCase(), password);

      setUserToken(res.token);
      setUser(res.user);
      await refreshLinks();
      toast(
        isRegister
          ? `Welcome, ${res.user.name}! Your free account is ready.`
          : `Welcome back, ${res.user.name}.`,
        "success",
      );
      setName("");
      setEmail("");
      setPassword("");
      closeAuth();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={authOpen}
      onClose={closeAuth}
      title={isRegister ? "Create Free Account" : "Welcome Back"}
      subtitle={
        isRegister
          ? "Start using your dashboard."
          : "Sign in to access your dashboard."
      }
      icon={<span className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 via-blue-500 to-violet-500 text-white flex items-center justify-center text-lg shadow-sm">◉</span>}
      maxWidth="max-w-md"
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-white/55 border border-white/80">
          {(
            [
              { id: "register", label: "Create Account" },
              { id: "login", label: "Sign In" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                click(600);
                openAuth(m.id);
              }}
              className={`py-2 px-2 text-[10.5px] font-black uppercase tracking-wider rounded-full transition-all active:scale-95 ${
                authMode === m.id ? "nav-pill-active shadow-md text-white" : "text-zinc-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {isRegister ? (
          <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Username</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Choose a username"
              autoComplete="nickname"
              maxLength={24}
              className="mt-1 w-full liquid-glass-input px-4 py-2.5 text-sm font-bold"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Gmail / Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="mt-1 w-full liquid-glass-input px-4 py-2.5 text-sm font-bold"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">
            Password
          </span>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={6}
              className="w-full liquid-glass-input px-4 py-2.5 pr-16 text-sm font-bold"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-full text-[9.5px] font-black uppercase tracking-wider text-zinc-600 hover:text-zinc-900"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {isRegister ? (
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700">Confirm Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
              minLength={6}
              className="mt-1 w-full liquid-glass-input px-4 py-2.5 text-sm font-bold"
            />
          </label>
        ) : null}

        {error ? (
          <p className="text-[11px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-3 py-2">
            ⚠️ {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full glass-orb orb-blue py-3 font-black text-sm uppercase tracking-wide disabled:opacity-55"
        >
          {busy ? "Please wait…" : isRegister ? "Create Account" : "Sign In to SupaShort"}
        </button>

        <p className="text-center text-[9px] font-semibold text-zinc-500">🔒 Account access is secured by the existing server login.</p>
      </form>
    </Modal>
  );
}
