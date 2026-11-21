/** Shared display helpers (GPU chipset naming, dates, numbers). */

export function formatGpuChipset(raw: string | null | undefined): string {
  if (!raw || raw === "Unknown" || raw === "Generic") return "Not Detected";
  const e = raw;

  if (/mali[- ]?g720/i.test(e)) return "ARM Mali-G720 (MediaTek Dimensity 9300)";
  if (/mali[- ]?g715/i.test(e)) return "ARM Mali-G715 (MediaTek Dimensity 9200)";
  if (/mali[- ]?g710/i.test(e)) return "ARM Mali-G710 (Dimensity 9000 / Tensor)";
  if (/mali[- ]?g77/i.test(e)) return "ARM Mali-G77 (MediaTek Dimensity 8050)";
  if (/mali[- ]?g68/i.test(e)) return "ARM Mali-G68 (Dimensity 1080 / Exynos)";
  if (/mali[- ]?g57/i.test(e)) return "ARM Mali-G57 (Dimensity 700 / Helio G99)";
  if (/mali[- ]?g52/i.test(e)) return "ARM Mali-G52 (Helio G88 / G85)";
  if (/mali/i.test(e)) {
    const m = e.match(/Mali-[A-Za-z0-9\s]+/i);
    return m ? `ARM ${m[0].trim()}` : "ARM Mali GPU";
  }
  if (/adreno/i.test(e)) {
    const m = e.match(/Adreno\s*(?:\(TM\))?\s*(\d+)/i);
    const n = m ? m[1] : "";
    const map: Record<string, string> = {
      "750": "Qualcomm Adreno 750 (Snapdragon 8 Gen 3)",
      "740": "Qualcomm Adreno 740 (Snapdragon 8 Gen 2)",
      "730": "Qualcomm Adreno 730 (Snapdragon 8 Gen 1)",
      "660": "Qualcomm Adreno 660 (Snapdragon 888)",
      "650": "Qualcomm Adreno 650 (Snapdragon 865)",
      "642": "Qualcomm Adreno 642 (Snapdragon 778G)",
      "642L": "Qualcomm Adreno 642L (Snapdragon 778G)",
      "619": "Qualcomm Adreno 619 (Snapdragon 695)",
      "610": "Qualcomm Adreno 610 (Snapdragon 680)",
    };
    return map[n] || (n ? `Qualcomm Adreno ${n}` : "Qualcomm Adreno GPU");
  }
  if (/apple/i.test(e)) return "Apple Silicon GPU";
  if (/powervr/i.test(e)) {
    const m = e.match(/PowerVR\s*[A-Za-z0-9]+/i);
    return m ? m[0] : "PowerVR GPU";
  }
  if (/intel/i.test(e)) {
    const m = e.match(/Intel\(R\)\s*[^,\)]+/i) || e.match(/Intel\s*[^,\)]+/i);
    return m ? m[0].trim() : "Intel Graphics";
  }
  if (/nvidia|geforce|rtx|gtx/i.test(e)) {
    const m = e.match(/(GeForce\s*[^,\)]+|RTX\s*[^,\)]+|GTX\s*[^,\)]+)/i);
    return m ? `NVIDIA ${m[0].trim()}` : "NVIDIA GeForce GPU";
  }
  if (/amd|radeon/i.test(e)) {
    const m = e.match(/Radeon\s*[^,\)]+/i);
    return m ? `AMD ${m[0].trim()}` : "AMD Radeon GPU";
  }
  return (
    e
      .replace(/^ANGLE \(([^,]+),\s*([^,\)]+).*\)$/, "$1 — $2")
      .replace(/^Google Inc\. \((.+)\)$/, "$1")
      .trim() || e
  );
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "Live";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Live";
  }
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "Today";
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "Today";
  }
}

export function prettyResolution(res: string | null | undefined): string {
  if (!res || res === "Unknown") return "Not Detected";
  return res.replace(/x/i, "×");
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
