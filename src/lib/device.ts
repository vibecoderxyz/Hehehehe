import { formatGpuChipset } from "@/lib/format";
import type { TelemetryPayload } from "@/lib/types";

/**
 * Client-side hardware / browser profiler.
 * Collects the same publicly-readable signals the reference dashboard shows:
 * device model, OS, browser, screen, GPU/WebGL, battery, network, timezone.
 */

interface NavigatorUAData {
  brands?: { brand: string; version: string }[];
  getHighEntropyValues?: (hints: string[]) => Promise<{
    model?: string;
    platform?: string;
    platformVersion?: string;
    architecture?: string;
    bitness?: string;
  }>;
}

function mapDeviceModel(model: string): string {
  if (!model) return "";
  const t = model.trim();
  const table: [RegExp, string][] = [
    [/^SM-S928/i, "Samsung Galaxy S24 Ultra"],
    [/^SM-S926/i, "Samsung Galaxy S24+"],
    [/^SM-S921/i, "Samsung Galaxy S24"],
    [/^SM-S918/i, "Samsung Galaxy S23 Ultra"],
    [/^SM-S916/i, "Samsung Galaxy S23+"],
    [/^SM-S911/i, "Samsung Galaxy S23"],
    [/^SM-S908/i, "Samsung Galaxy S22 Ultra"],
    [/^SM-G998/i, "Samsung Galaxy S21 Ultra"],
    [/^SM-G991/i, "Samsung Galaxy S21"],
    [/^SM-A556/i, "Samsung Galaxy A55"],
    [/^SM-A546/i, "Samsung Galaxy A54"],
    [/^SM-A536/i, "Samsung Galaxy A53"],
    [/^SM-A356/i, "Samsung Galaxy A35"],
    [/^SM-A346/i, "Samsung Galaxy A34"],
    [/^SM-A256/i, "Samsung Galaxy A25"],
    [/^SM-A155|^SM-A156/i, "Samsung Galaxy A15"],
    [/^SM-A145|^SM-A146/i, "Samsung Galaxy A14"],
    [/^SM-A055|^SM-A057/i, "Samsung Galaxy A05"],
    [/^SM-F946/i, "Samsung Galaxy Z Fold 5"],
    [/^SM-F731/i, "Samsung Galaxy Z Flip 5"],
    [/^SM-[A-Za-z0-9]+/i, ""],
    [/^CK8n/i, "Tecno Camon 20 Pro 5G"],
    [/^CK7n/i, "Tecno Camon 20 Premier"],
    [/^CK6n/i, "Tecno Camon 20"],
    [/^LH8n/i, "Tecno Spark 20 Pro+"],
    [/^BG6/i, "Tecno Spark 20"],
    [/^KJ5/i, "Tecno Spark 20C"],
    [/^X6836/i, "Infinix Zero 30"],
    [/^X6831/i, "Infinix Hot 30"],
    [/^X6837/i, "Infinix Hot 40 Pro"],
    [/^X6525/i, "Infinix Smart 8"],
    [/^X6823/i, "Infinix Note 30"],
    [/^X6850/i, "Infinix Note 40 Pro"],
    [/^23124RN87G|^2312DRA50G/i, "Redmi Note 13 Pro"],
    [/^23129RAA4G/i, "Redmi Note 13"],
    [/^22101316G/i, "Xiaomi 13 Pro"],
    [/^2311DRK48G/i, "POCO X6 Pro"],
    [/^2201116PG/i, "POCO X4 Pro"],
    [/^V2324A|^V2309/i, "Vivo X100"],
    [/^V2318/i, "Vivo V30"],
    [/^V2250/i, "Vivo V27"],
    [/^V2111/i, "Vivo Y21"],
  ];
  for (const [re, name] of table) {
    if (re.test(t)) {
      if (name) return name;
      if (/^SM-/i.test(t)) return `Samsung ${t.toUpperCase()}`;
    }
  }
  if (/^X\d{4}/i.test(t)) return `Infinix ${t.toUpperCase()}`;
  if (/^V\d{4}/i.test(t)) return `Vivo ${t.toUpperCase()}`;
  if (/^RMX\d{4}/i.test(t)) return `Realme ${t.toUpperCase()}`;
  if (/^CPH\d{4}/i.test(t)) return `Oppo ${t.toUpperCase()}`;
  return t;
}

export async function collectDeviceProfile(): Promise<TelemetryPayload> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const ua = nav?.userAgent || "";
  const maxTouch = typeof nav?.maxTouchPoints === "number" ? nav.maxTouchPoints : 0;

  let model = "";
  let platform = "";
  let platformVersion = "";
  let brandHint = "";

  const uaData = (nav as unknown as { userAgentData?: NavigatorUAData })?.userAgentData;
  if (uaData) {
    try {
      if (uaData.brands && Array.isArray(uaData.brands)) {
        const b = uaData.brands.find(
          (x) => !x.brand.includes("Not") && !x.brand.includes("Chromium"),
        );
        if (b) brandHint = b.brand;
      }
      if (typeof uaData.getHighEntropyValues === "function") {
        const hi = await Promise.race([
          uaData.getHighEntropyValues(["model", "platform", "platformVersion"]),
          new Promise<never>((r) => setTimeout(() => r(null), 200)),
        ]);
        if (hi) {
          if (hi.model) model = hi.model;
          if (hi.platform) platform = hi.platform;
          if (hi.platformVersion) platformVersion = hi.platformVersion;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!model && ua) {
    const m1 = ua.match(/\b(SM-[A-Za-z0-9]+)\b/i);
    const m2 = ua.match(/\b(Tecno[\s-][A-Za-z0-9\s]+?)(?=[;)/])/i);
    const m3 = ua.match(/\b(Infinix[\s-][A-Za-z0-9\s]+?)(?=[;)/])/i);
    const m4 = ua.match(/\b(Redmi[\s-][A-Za-z0-9\s]+?)(?=[;)/])/i);
    const m5 = ua.match(/\b(POCO[\s-][A-Za-z0-9\s]+?|Mi[\s-][A-Za-z0-9\s]+?)(?=[;)/])/i);
    const m6 = ua.match(/;\s*([A-Za-z0-9\-_\s]{3,30})\s+Build\//i);
    if (m1) model = m1[1];
    else if (m2) model = m2[1].trim();
    else if (m3) model = m3[1].trim();
    else if (m4) model = m4[1].trim();
    else if (m5) model = m5[1].trim();
    else if (m6) {
      const v = m6[1].trim();
      if (!/^(Linux|Android|U|arm|x86|Release|Version)/i.test(v)) model = v;
    }
  }

  let os = platform || "Unknown";
  let osVersion = platformVersion || "";
  if ((!os || os === "Unknown") && ua) {
    if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
    else if (/windows nt 10\.0/i.test(ua)) os = "Windows";
    else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
    else if (/linux/i.test(ua)) os = "Linux";
  }
  if (!osVersion && ua) {
    if (os === "Android") {
      const m = ua.match(/Android\s+([0-9.]+)/i);
      if (m) osVersion = m[1];
    } else if (os === "iOS") {
      const m = ua.match(/OS\s+([0-9_]+)/i);
      if (m) osVersion = m[1].replace(/_/g, ".");
    } else if (os === "Windows") {
      osVersion = /Windows NT 6\.3/i.test(ua)
        ? "8.1"
        : /Windows NT 6\.1/i.test(ua)
          ? "7"
          : "10/11";
    } else if (os === "macOS") {
      const m = ua.match(/Mac OS X\s+([0-9_]+)/i);
      if (m) osVersion = m[1].replace(/_/g, ".");
    }
  }

  const isTablet = /ipad|tablet/i.test(ua) || (maxTouch > 0 && screen.width >= 768 && screen.width <= 1024);
  const isMobile = /android|iphone|ipod/i.test(ua) || (maxTouch > 0 && screen.width < 768);

  const modelName =
    (model ? mapDeviceModel(model) : "") ||
    (os === "Android"
      ? "Android Phone"
      : os === "iOS"
        ? /ipad/i.test(ua)
          ? "Apple iPad"
          : "Apple iPhone"
        : os === "Windows"
          ? "Windows PC"
          : os === "macOS"
            ? "Apple Mac"
            : os === "Linux"
              ? "Linux Desktop"
              : maxTouch > 0
                ? "Mobile Device"
                : "Desktop PC");

  const deviceType = `${modelName} (${isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop"})`;

  let browser = brandHint || "Unknown";
  let browserVersion = "";
  if (ua) {
    if (/edg\//i.test(ua)) {
      browser = "Edge";
      browserVersion = (ua.match(/edg\/([0-9.]+)/i) || [])[1] || "";
    } else if (/chrome\//i.test(ua) && !/opr|opera/i.test(ua)) {
      browser = "Chrome";
      browserVersion = (ua.match(/chrome\/([0-9.]+)/i) || [])[1] || "";
    } else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) {
      browser = "Safari";
      browserVersion = (ua.match(/version\/([0-9.]+)/i) || [])[1] || "";
    } else if (/firefox\//i.test(ua)) {
      browser = "Firefox";
      browserVersion = (ua.match(/firefox\/([0-9.]+)/i) || [])[1] || "";
    } else if (/opr|opera/i.test(ua)) {
      browser = "Opera";
      browserVersion = (ua.match(/(?:opr|opera)\/([0-9.]+)/i) || [])[1] || "";
    }
  }

  let batteryLevel: number | null = null;
  let isCharging: boolean | null = null;
  if (nav && "getBattery" in nav) {
    try {
      const battery = await Promise.race([
        (
          nav as unknown as {
            getBattery: () => Promise<{ level: number; charging: boolean }>;
          }
        ).getBattery(),
        new Promise<never>((r) => setTimeout(() => r(null), 250)),
      ]);
      if (battery && typeof battery.level === "number") {
        batteryLevel = Number(battery.level.toFixed(2));
        isCharging = !!battery.charging;
      }
    } catch {
      /* ignore */
    }
  }

  let webglVendor = "Unknown";
  let webglRenderer = "Unknown";
  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          webglVendor = (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) || "Unknown";
          webglRenderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || "Unknown";
        }
      }
    } catch {
      /* ignore */
    }
  }

  const connection =
    nav &&
    (nav as unknown as { connection?: { effectiveType?: string; type?: string } }).connection;

  const screenResolution =
    typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "Unknown";

  return {
    deviceType,
    deviceModel: modelName,
    os: osVersion ? `${os} ${osVersion}` : os,
    osVersion: osVersion ? `${os} ${osVersion}` : os,
    browser: browserVersion ? `${browser} ${browserVersion.split(".")[0]}` : browser,
    browserVersion,
    userAgent: ua,
    rawUserAgent: ua,
    screenResolution,
    screenColorDepth: typeof window !== "undefined" ? window.screen.colorDepth : null,
    timezone:
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Unknown",
    language: nav?.language || "en",
    hardwareConcurrency: nav?.hardwareConcurrency ?? null,
    deviceMemory:
      (nav as unknown as { deviceMemory?: number } | undefined)?.deviceMemory ?? null,
    networkType: connection?.effectiveType || connection?.type || "Unknown",
    touchPoints: maxTouch,
    batteryLevel,
    isCharging,
    gpuChipset: formatGpuChipset(webglRenderer !== "Unknown" ? webglRenderer : webglVendor),
    webglVendor,
    webglRenderer,
  };
}

/** Snapshot of the device; used for the standalone HTML export default state. */
export function deviceSummary(p: TelemetryPayload) {
  const isMobile = /mobile/i.test(p.deviceType || "");
  const isTablet = /tablet/i.test(p.deviceType || "");
  return { isMobile, isTablet };
}
