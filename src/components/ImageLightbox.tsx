"use client";

import { useApp } from "@/components/AppProvider";

/** Full-screen evidence viewer with a download action (reference parity). */
export function ImageLightbox() {
  const { lightbox, setLightbox, click } = useApp();
  if (!lightbox) return null;

  const download = () => {
    const a = document.createElement("a");
    a.href = lightbox;
    a.download = `captured-intel-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-[#0d1722]/90 backdrop-blur-xl animate-fade-in">
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 flex items-center gap-2 sm:gap-3 z-10">
        <button
          onClick={() => {
            click(600);
            download();
          }}
          className="clay-teal-btn flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 text-[10.5px] sm:text-[11px] text-white font-extrabold uppercase tracking-wider transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          <span>Download</span>
        </button>
        <button
          onClick={() => {
            click(380);
            setLightbox(null);
          }}
          aria-label="Close viewer"
          className="w-9 h-9 sm:w-11 sm:h-11 clay-circle-grey flex items-center justify-center text-[#243747] hover:text-[#0f1922] transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="w-full max-w-3xl max-h-[82vh] relative clay-board p-3 overflow-hidden shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightbox}
          className="w-full h-full max-h-[78vh] object-contain rounded-2xl"
          alt="Captured visitor evidence"
        />
        <div className="absolute inset-3 pointer-events-none rounded-2xl border border-white/20 font-mono text-[9px] text-[#1c3848] p-4 flex flex-col justify-between font-bold">
          <div className="flex justify-between">
            <span className="clay-badge-teal px-2 py-0.5 text-white">INTEL_NODE_LITE_SECURE</span>
            <span className="clay-small-pill px-2 py-0.5 text-[#1b3445]">
              {new Date().toISOString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="clay-badge-blue px-2 py-0.5 text-white">Captured Evidence</span>
            <span className="clay-small-pill px-2 py-0.5 text-[#1b3445]">AES-256</span>
          </div>
        </div>
      </div>
    </div>
  );
}