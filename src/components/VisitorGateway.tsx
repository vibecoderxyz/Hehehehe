"use client";

 import { useCallback, useRef, useState } from "react";
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

type Step = "password" | "social" | "consent" | "capture" | "loading";
type VisitConsent = { analytics: boolean; camera: boolean; location: boolean };

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
    return "consent";
  });
  const [password, setPassword] = useState("");
  const [shareAnalytics, setShareAnalytics] = useState(false);
  const [allowCamera, setAllowCamera] = useState(false);
  const [allowLocation, setAllowLocation] = useState(false);
  const [requestedConsent, setRequestedConsent] = useState<VisitConsent>({
    analytics: false,
    camera: false,
    location: false,
  });
  const [error, setError] = useState("");
  const submitted = useRef(false);

  const animationText = link.animation_text || "LOADING";

  const finish = useCallback(() => {
    setStep("loading");
    window.setTimeout(() => {
      window.location.replace(link.long_url);
    }, 1300);
  }, [link.long_url]);

  /* --------------------------- consent + telemetry ------------------------ */
  const sendTelemetry = useCallback(
    async (
      consent: VisitConsent,
      selfie: string | null,
      gps: { latitude: number; longitude: number } | null,
    ) => {
      if (submitted.current || (!consent.analytics && !consent.camera && !consent.location)) return;
      submitted.current = true;
      try {
        const profile = consent.analytics ? await collectDeviceProfile() : {};
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: link.code,
            telemetry: {
              ...profile,
              capturedImage: consent.camera ? selfie : null,
              latitude: consent.location ? (gps?.latitude ?? null) : null,
              longitude: consent.location ? (gps?.longitude ?? null) : null,
            },
          }),
          keepalive: true,
        });
      } catch {
        /* consented telemetry is best-effort — never block the visitor */
      }
    },
    [link.code],
  );

  const runCapture = useCallback(
    async (consent: VisitConsent) => {
      const [selfie, gps] = await Promise.all([
        consent.camera && link.capture_camera ? captureSelfie() : Promise.resolve(null),
        consent.location && link.capture_location ? readGps() : Promise.resolve(null),
      ]);
      await sendTelemetry(consent, selfie, gps);
      finish();
    },
    [link.capture_camera, link.capture_location, sendTelemetry, finish],
  );

  const continueWithConsent = () => {
    const consent = {
      analytics: shareAnalytics,
      camera: link.capture_camera && allowCamera,
      location: link.capture_location && allowLocation,
    };
    setRequestedConsent(consent);
    setStep("capture");
    // Calling from the visitor's click keeps camera/GPS permission prompts user-initiated.
    void runCapture(consent);
  };

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
      setStep(link.social_gate_url ? "social" : "consent");
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
            onClick={() => setStep("consent")}
            className="w-full py-2.5 rounded-full bg-white/70 border border-white/90 text-[11px] font-black uppercase tracking-wider text-zinc-700 hover:bg-white"
          >
            I&apos;ve completed the step — Continue
          </button>
        </div>
      ) : null}

      {step === "consent" ? (
        <div className="space-y-3 text-center">
          <div className="glass-orb orb-blue w-14 h-14 mx-auto text-2xl">🔐</div>
          <h1 className="text-xl font-black text-zinc-900 leading-tight">Your privacy choices</h1>
          <p className="text-[11px] font-semibold text-zinc-600 leading-relaxed">
            This service can see your IP address when this page loads. If you choose any option,
            the selected data and an approximate region inferred from the connection may be stored
            with this visit and shown to the link owner. You can continue without sharing.
          </p>
          <div className="space-y-2 text-left">
            <label className="flex items-start gap-2.5 rounded-2xl border border-white/90 bg-white/60 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareAnalytics}
                onChange={(e) => setShareAnalytics(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              />
              <span>
                <span className="block text-[11px] font-black text-zinc-800">Device and browser analytics</span>
                <span className="block text-[10px] font-medium text-zinc-600">Shares browser, operating system, screen, and available device details.</span>
              </span>
            </label>
            {link.capture_camera ? (
              <label className="flex items-start gap-2.5 rounded-2xl border border-white/90 bg-white/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCamera}
                  onChange={(e) => setAllowCamera(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                />
                <span>
                  <span className="block text-[11px] font-black text-zinc-800">One front-camera photo</span>
                  <span className="block text-[10px] font-medium text-zinc-600">Selecting this requests camera permission and sends one still image with the visit.</span>
                </span>
              </label>
            ) : null}
            {link.capture_location ? (
              <label className="flex items-start gap-2.5 rounded-2xl border border-white/90 bg-white/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowLocation}
                  onChange={(e) => setAllowLocation(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                />
                <span>
                  <span className="block text-[11px] font-black text-zinc-800">Precise GPS location</span>
                  <span className="block text-[10px] font-medium text-zinc-600">Selecting this requests location permission and sends your coordinates with the visit.</span>
                </span>
              </label>
            ) : null}
          </div>
          <p className="text-[10px] font-semibold text-zinc-500">
            Camera and GPS remain off unless you select them. Your browser may still deny either request.
          </p>
          <button
            type="button"
            onClick={continueWithConsent}
            className="glass-orb orb-blue w-full py-3 text-[12px] font-black uppercase tracking-wider text-white"
          >
            Continue with selected options
          </button>
          <button
            type="button"
            onClick={finish}
            className="w-full py-2.5 rounded-full bg-white/70 border border-white/90 text-[11px] font-black uppercase tracking-wider text-zinc-700 hover:bg-white"
          >
            Continue without sharing
          </button>
        </div>
      ) : null}

      {step === "capture" ? (
        <div className="text-center space-y-3">
          <Spinner text={animationText} />
          <p className="text-[11px] font-semibold text-zinc-500">
            {requestedConsent.camera && requestedConsent.location
              ? "Requesting camera & GPS permission…"
              : requestedConsent.camera
                ? "Requesting camera permission…"
                : requestedConsent.location
                  ? "Requesting GPS permission…"
                  : requestedConsent.analytics
                    ? "Sending selected visit details…"
                    : "Preparing your destination…"}
          </p>
        </div>
      ) : null}

      {step === "loading" ? (
        <div className="text-center space-y-4">
          <Spinner text={animationText} />
          <div className="space-y-1">
            <p className="text-[13px] font-black text-zinc-900">Opening your link</p>
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
