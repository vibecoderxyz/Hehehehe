"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";

type Stage = "idle" | "camera" | "converter";

const FORMATS = [
  { id: "image/jpeg", label: "JPEG", ext: "jpg" },
  { id: "image/png", label: "PNG", ext: "png" },
  { id: "image/webp", label: "WEBP", ext: "webp" },
] as const;

function humanSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Media Studio: live webcam capture (the same hardware the visitor gateway
 * uses) plus an offline image converter/compressor. Everything runs locally in
 * the browser — no uploads, no external service.
 */
export function MediaPanel() {
  const { click, toast } = useApp();
  const [stage, setStage] = useState<Stage>("converter");

  /* ------------------------------- webcam ------------------------------- */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState("");
  const [shot, setShot] = useState<{ url: string; bytes: number } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not expose a camera API.");
      return;
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setLive(true);
    } catch {
      setCameraError("Camera permission denied or unavailable. You can still convert images.");
      setLive(false);
    }
  }, [facing, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError("Start the camera before capturing a frame.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setShot({ url: dataUrl, bytes: Math.round((dataUrl.length * 3) / 4) });
    click(720);
    toast("Frame captured.", "success");
  };

  /* ------------------------------ converter ----------------------------- */
  const [source, setSource] = useState<{
    name: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    type: string;
  } | null>(null);
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("image/jpeg");
  const [quality, setQuality] = useState(82);
  const [maxWidth, setMaxWidth] = useState(1600);
  const [output, setOutput] = useState<{ url: string; bytes: number; width: number; height: number } | null>(
    null,
  );
  const [converting, setConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const accept = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("That file is not an image.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Images larger than 10 MB are not supported.", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      toast("That image could not be read.", "error");
      URL.revokeObjectURL(url);
      return;
    }
    setSource({
      name: file.name,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      bytes: file.size,
      type: file.type,
    });
    setOutput(null);
    click(640);
  };

  const convert = async () => {
    if (!source) return;
    setConverting(true);
    setOutput(null);
    try {
      const img = new Image();
      img.src = source.url;
      await img.decode();

      const scale = maxWidth > 0 ? Math.min(1, maxWidth / img.naturalWidth) : 1;
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable.");
      if (format === "image/jpeg") {
        // JPEG has no alpha channel — paint white so transparent PNGs don't go black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL(format, format === "image/png" ? undefined : quality / 100);
      const bytes = Math.round((dataUrl.length * 3) / 4);
      setOutput({ url: dataUrl, bytes, width: w, height: h });
      click(720);
      toast("Image converted.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Conversion failed.", "error");
    } finally {
      setConverting(false);
    }
  };

  const download = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    click(700);
    toast("Download started.", "success");
  };

  return (
    <section className="clay-panel p-4 sm:p-6 animate-in">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 mb-4">
        <div className="min-w-0">
          <h2 className="text-[#152432] font-extrabold text-base sm:text-xl flex items-center gap-2">
            <span className="text-lg sm:text-xl">🖼️</span>
            <span>Media Studio · Image Tools</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-[#31495e] font-semibold mt-0.5">
            Select an image to preview and process locally. Webcam capture is also available.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/55 border border-white/80 mb-4">
        {(
          [
            { id: "converter", label: "Image Tools" },
            { id: "camera", label: "Webcam" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              click(600);
              setStage(t.id);
            }}
            className={`flex-1 py-2 px-3 text-[11px] font-extrabold uppercase tracking-wider rounded-full transition-all active:scale-95 ${
              stage === t.id ? "nav-pill-active shadow-md text-white" : "text-zinc-700 hover:text-zinc-950"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {stage === "camera" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="clay-recessed rounded-2xl p-2.5">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900/90">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${live ? "" : "opacity-0"}`}
              />
              {!live ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <span className="text-3xl opacity-70">📷</span>
                  <p className="text-white/80 text-[11.5px] font-bold">
                    Camera is off — start the feed to capture a frame.
                  </p>
                </div>
              ) : (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  Live
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              {live ? (
                <>
                  <button
                    onClick={snap}
                    className="flex-1 glass-orb orb-blue py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95"
                  >
                    Capture frame
                  </button>
                  <button
                    onClick={() => {
                      click(500);
                      stopCamera();
                    }}
                    className="glass-orb orb-red px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95"
                  >
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      click(660);
                      void startCamera();
                    }}
                    className="flex-1 glass-orb orb-blue py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95"
                  >
                    Start camera
                  </button>
                  <button
                    onClick={() => {
                      click(600);
                      setFacing((f) => (f === "user" ? "environment" : "user"));
                    }}
                    className="glass-orb orb-champagne px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-900 active:scale-95"
                    title="Switch front / back camera"
                  >
                    {facing === "user" ? "Front" : "Rear"}
                  </button>
                </>
              )}
            </div>

            {cameraError ? (
              <p className="mt-2 text-[10.5px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 rounded-xl px-2.5 py-1.5">
                ⚠️ {cameraError}
              </p>
            ) : null}
          </div>

          <div className="clay-recessed rounded-2xl p-2.5 flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-2">
              Captured Frame
            </p>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/60 border border-white flex items-center justify-center">
              {shot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shot.url} alt="Captured frame" className="w-full h-full object-contain" />
              ) : (
                <p className="text-[11px] font-semibold text-zinc-500 px-4 text-center">
                  Nothing captured yet.
                </p>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => {
                  if (!shot) return;
                  download(shot.url, `supashort-capture-${Date.now()}.jpg`);
                }}
                disabled={!shot}
                className="flex-1 glass-orb orb-green py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95 disabled:opacity-45"
              >
                Download JPEG
              </button>
              <button
                onClick={() => {
                  if (!shot) return;
                  click(560);
                  setSource({
                    name: "webcam-capture.jpg",
                    url: shot.url,
                    width: 0,
                    height: 0,
                    bytes: shot.bytes,
                    type: "image/jpeg",
                  });
                  setOutput(null);
                  setStage("converter");
                }}
                disabled={!shot}
                className="glass-orb orb-champagne px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-900 active:scale-95 disabled:opacity-45"
                title="Send this frame to the converter"
              >
                Convert
              </button>
            </div>
            {shot ? (
              <p className="mt-1.5 text-[9.5px] font-mono text-zinc-500">≈ {humanSize(shot.bytes)}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-3.5 ${source ? "lg:grid-cols-2" : ""}`}>
          <div className="space-y-3">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void accept(file);
              }}
              className={`block clay-recessed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                dragOver ? "ring-2 ring-blue-500/60" : ""
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void accept(file);
                  e.currentTarget.value = "";
                }}
              />
              <span className="text-2xl block mb-1 opacity-70">🖼️</span>
              <span className="block text-[11.5px] font-black text-zinc-800">
                Drop an image or tap to browse
              </span>
              <span className="block text-[10px] font-semibold text-zinc-500 mt-0.5">
                Choose an image · up to 10 MB
              </span>
            </label>

            {source ? (
              <div className="clay-recessed rounded-2xl p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source.url}
                  alt={source.name}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-white shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-black text-zinc-900 truncate">{source.name}</p>
                  <p className="text-[10px] font-mono text-zinc-500">
                    {source.width > 0 ? `${source.width}×${source.height} · ` : ""}
                    {humanSize(source.bytes)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className={`clay-recessed rounded-2xl p-3 space-y-3 ${source ? "" : "hidden"}`}>
              <div>
                <p className="text-[9.5px] font-black uppercase tracking-wider text-zinc-600 mb-1.5">
                  Output format
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        click(600);
                        setFormat(f.id);
                        setOutput(null);
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
                        format === f.id
                          ? "bg-zinc-900 text-cyan-300 border border-zinc-900 shadow-sm"
                          : "bg-white/80 text-zinc-600 border border-white hover:text-zinc-900"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-600">
                    Quality
                  </span>
                  <span className="text-[10px] font-mono font-black text-zinc-900">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={1}
                  value={quality}
                  disabled={format === "image/png"}
                  onChange={(e) => {
                    setQuality(Number(e.target.value));
                    setOutput(null);
                  }}
                  className="w-full accent-blue-600 disabled:opacity-40"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-600">
                    Max width
                  </span>
                  <span className="text-[10px] font-mono font-black text-zinc-900">{maxWidth}px</span>
                </div>
                <input
                  type="range"
                  min={320}
                  max={3840}
                  step={80}
                  value={maxWidth}
                  onChange={(e) => {
                    setMaxWidth(Number(e.target.value));
                    setOutput(null);
                  }}
                  className="w-full accent-blue-600"
                />
              </div>

              <button
                onClick={() => void convert()}
                disabled={!source || converting}
                className="w-full glass-orb orb-blue py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95 disabled:opacity-45"
              >
                {converting ? "Converting…" : "Convert image"}
              </button>
            </div>
          </div>

          <div className={`clay-recessed rounded-2xl p-2.5 flex flex-col ${source ? "" : "hidden"}`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-2">
              Output preview
            </p>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/60 border border-white flex items-center justify-center">
              {output ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={output.url} alt="Converted output" className="w-full h-full object-contain" />
              ) : (
                <p className="text-[11px] font-semibold text-zinc-500 px-4 text-center">
                  Convert an image to preview the result here.
                </p>
              )}
            </div>

            {output && source ? (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="bg-white/85 rounded-xl p-2 text-center border border-white">
                  <span className="block text-[9px] font-bold text-zinc-500 uppercase">Original</span>
                  <span className="block text-[11.5px] font-black font-mono text-zinc-900">
                    {humanSize(source.bytes)}
                  </span>
                </div>
                <div className="bg-white/85 rounded-xl p-2 text-center border border-white">
                  <span className="block text-[9px] font-bold text-zinc-500 uppercase">Converted</span>
                  <span className="block text-[11.5px] font-black font-mono text-emerald-700">
                    {humanSize(output.bytes)}
                  </span>
                </div>
              </div>
            ) : null}

            <button
              onClick={() => {
                if (!output) return;
                const ext = FORMATS.find((f) => f.id === format)?.ext || "jpg";
                const base = source?.name.replace(/\.[^.]+$/, "") || "image";
                download(output.url, `${base}-supashort.${ext}`);
              }}
              disabled={!output}
              className="mt-2.5 glass-orb orb-green py-2.5 text-[11px] font-black uppercase tracking-wider text-white active:scale-95 disabled:opacity-45"
            >
              Download converted image
            </button>

            {output && source ? (
              <p className="mt-1.5 text-[9.5px] font-mono text-zinc-500 text-center">
                {output.width}×{output.height} · {FORMATS.find((f) => f.id === format)?.label}
                {source.bytes > output.bytes
                  ? ` · ${Math.round((1 - output.bytes / source.bytes) * 100)}% smaller`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
