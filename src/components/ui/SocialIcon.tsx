"use client";

export type SocialKey =
  | "youtube"
  | "instagram"
  | "twitter"
  | "facebook"
  | "whatsapp"
  | "telegram"
  | "tiktok"
  | "snapchat"
  | "linkedin"
  | "link";

export const SOCIAL_PLATFORMS: {
  key: SocialKey;
  label: string;
  brand: string;
  hint: string;
}[] = [
  { key: "youtube", label: "YouTube", brand: "#ff0033", hint: "Subscribe gate" },
  { key: "instagram", label: "Instagram", brand: "#e1306c", hint: "Follow gate" },
  { key: "twitter", label: "X / Twitter", brand: "#0f1419", hint: "Follow gate" },
  { key: "facebook", label: "Facebook", brand: "#1877f2", hint: "Like gate" },
  { key: "whatsapp", label: "WhatsApp", brand: "#25d366", hint: "Channel gate" },
  { key: "telegram", label: "Telegram", brand: "#229ed9", hint: "Join gate" },
  { key: "tiktok", label: "TikTok", brand: "#010101", hint: "Follow gate" },
  { key: "snapchat", label: "Snapchat", brand: "#fffc00", hint: "Add gate" },
  { key: "linkedin", label: "LinkedIn", brand: "#0a66c2", hint: "Connect gate" },
  { key: "link", label: "Custom", brand: "#334155", hint: "Generic gate" },
];

const PATHS: Record<SocialKey, string> = {
  youtube:
    "M21.6 7.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C16.9 4.1 12 4.1 12 4.1h0s-4.9 0-6.7.2c-.4 0-1.3.1-2.1.9-.6.6-.8 2-.8 2S2.1 8.8 2.1 10.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.8.8 1.8.8 2.3.9 1.7.2 6.6.2 6.6.2s4.9 0 6.7-.2c.4-.1 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.7-.2-3.3-.2-3.3zM10 14.6V8.4l5.6 3.1L10 14.6z",
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.1.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.1-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.1-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.1 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.4a6.4 6.4 0 100 12.8 6.4 6.4 0 000-12.8zm0 10.6a4.2 4.2 0 110-8.4 4.2 4.2 0 010 8.4zm8.2-10.9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z",
  twitter:
    "M18.9 2.5h3.4l-7.4 8.5 8.7 11.5h-6.8l-5.3-7-6.1 7H2l7.9-9.1L1.5 2.5h7l4.8 6.4 5.6-6.4zm-1.2 18h1.9L6.3 4.4H4.3l13.4 16.1z",
  facebook:
    "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.9 3.78-3.9 1.1 0 2.24.19 2.24.19v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z",
  whatsapp:
    "M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.4.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2z",
  telegram:
    "M21.9 4.3L18.6 20c-.2 1.1-.9 1.3-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.4-8.5c.4-.4-.1-.6-.6-.2L6.9 12.9 2 11.4c-1.1-.3-1.1-1 .2-1.5l18.2-7c.9-.3 1.7.2 1.5 1.4z",
  tiktok:
    "M16.6 2h-3.1v13.2a2.7 2.7 0 11-2.7-2.7c.3 0 .5 0 .8.1V9.4a6 6 0 00-.8-.1 5.9 5.9 0 105.9 5.9V8.6a7.2 7.2 0 004.2 1.3V6.7a4.2 4.2 0 01-4.3-4.7z",
  snapchat:
    "M12.2 2c2.6 0 4.4 1.9 4.4 4.5 0 .8-.1 1.5-.1 2 .2.2.5.2.8.1.3-.1.6-.2.8-.1.4.1.6.4.6.8 0 .5-.6.8-1.2 1-.4.2-.8.3-.8.7 0 .5.8 1.5 1.6 2.1.6.5 1.3.8 1.9.9.3 0 .5.2.5.5 0 .6-.9 1-1.7 1.2-.2 0-.4.1-.4.3-.1.3-.1.7-.3.9-.2.1-.5.1-.8.1-.4 0-.9-.1-1.5.1-.5.2-1 1.6-2.6 1.6-.9 0-1.4-.4-2-.7-.4-.2-.7-.3-1.1-.3-.4 0-.8.2-1.2.4-.5.3-1 .6-1.9.6-1.6 0-2.1-1.4-2.6-1.6-.5-.2-1-.1-1.4-.1-.3 0-.6 0-.7-.1-.2-.2-.3-.6-.3-.9 0-.2-.2-.3-.4-.3-.8-.2-1.7-.6-1.7-1.2 0-.3.2-.5.5-.5.6-.1 1.3-.4 1.9-.9.8-.6 1.6-1.6 1.6-2.1 0-.4-.4-.5-.8-.7-.6-.2-1.2-.5-1.2-1 0-.4.2-.7.6-.8.2-.1.5 0 .8.1.3.1.6.1.8-.1 0-.5-.1-1.2-.1-2C7.6 3.9 9.4 2 12 2z",
  linkedin:
    "M20.4 3H3.6C2.7 3 2 3.7 2 4.6v14.8c0 .9.7 1.6 1.6 1.6h16.8c.9 0 1.6-.7 1.6-1.6V4.6c0-.9-.7-1.6-1.6-1.6zM8.3 18.3H5.6V9.8h2.7v8.5zM7 8.6a1.6 1.6 0 110-3.2 1.6 1.6 0 010 3.2zm11.3 9.7h-2.7v-4.4c0-1.1-.4-1.8-1.3-1.8-.8 0-1.2.5-1.4 1-.1.2-.1.4-.1.7v4.5h-2.7V9.8h2.7v1.2c.4-.6 1.1-1.4 2.5-1.4 1.8 0 3 1.2 3 3.6v5.1z",
  link:
    "M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7L11 6m3 5a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7L13 18",
};

export function SocialIcon({
  platform,
  className = "w-5 h-5",
  colored = true,
}: {
  platform: string;
  className?: string;
  colored?: boolean;
}) {
  const key = (SOCIAL_PLATFORMS.find((p) => p.key === platform)?.key ||
    "link") as SocialKey;
  const meta = SOCIAL_PLATFORMS.find((p) => p.key === key)!;

  if (key === "link") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke={colored ? meta.brand : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={PATHS.link} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={colored ? meta.brand : "currentColor"}
      aria-hidden="true"
    >
      <path d={PATHS[key]} />
    </svg>
  );
}

export function platformMeta(platform: string) {
  return SOCIAL_PLATFORMS.find((p) => p.key === platform) || SOCIAL_PLATFORMS[9];
}