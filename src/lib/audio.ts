/**
 * Zero-audio-framework click "bubble" feedback used across the whole UI.
 * Recreated from the reference build (a short pitched sine blip).
 * It is a plain, non-blocking effect and is never required for functionality.
 */

let ctx: AudioContext | null = null;
let enabled = true;

type AudioCtor = typeof AudioContext;

function getCtor(): AudioCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  );
}

export function playBubble(freq = 580): void {
  if (!enabled) return;
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.45, ctx.currentTime + 0.055);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  } catch {
    /* audio is a progressive enhancement only */
  }
}

/** Toggles sound and returns the new enabled state. Blips when turning on. */
export function toggleSound(): boolean {
  enabled = !enabled;
  if (enabled) playBubble(660);
  return enabled;
}

export function isSoundEnabled(): boolean {
  return enabled;
}
