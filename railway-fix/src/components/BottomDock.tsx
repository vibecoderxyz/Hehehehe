"use client";

import { useApp } from "@/components/AppProvider";

const ITEMS: {
  key: "create" | "media" | "analytics" | "recent";
  label: string;
  title: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "create",
    label: "Shorten",
    title: "Shorten & Generate Smart Links",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-[19px] h-[19px]">
        <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7L11 6" />
        <path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7L13 18" />
      </svg>
    ),
  },
  {
    key: "media",
    label: "Media",
    title: "Webcam & Media Capture Feed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-[19px] h-[19px]">
        <rect x="2" y="6" width="14" height="12" rx="3" />
        <path d="M16 10l6-3v10l-6-3z" />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Stats",
    title: "Live Visitor GPS & Device Analytics",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-[19px] h-[19px]">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 4-6" />
      </svg>
    ),
  },
  {
    key: "recent",
    label: "Recent",
    title: "Recent Links History",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-[19px] h-[19px]">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

export function BottomDock() {
  const { tab, setTab, click, setCouponOpen, user, openAuth } = useApp();

  return (
    <div className="safe-bottom-bar w-[min(94vw,32rem)] lg:hidden">
      <nav className="liquid-glass-dock rounded-[22px] px-1.5 py-1.5 flex items-stretch gap-0.5">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            title={item.title}
            onClick={() => {
              click(item.key === "create" ? 520 : item.key === "media" ? 600 : item.key === "analytics" ? 560 : 640);
              setTab(item.key);
            }}
            className={`dock-nav-btn flex-1 ${tab === item.key ? "dock-nav-btn-active" : ""}`}
            aria-current={tab === item.key ? "page" : undefined}
          >
            {item.icon}
            <span className="text-[9.5px] font-black tracking-tight">{item.label}</span>
          </button>
        ))}
        <button
          title="Redeem Coupon Code & Manage Plan"
          onClick={() => {
            click(660);
            if (user) setCouponOpen(true);
            else openAuth("login");
          }}
          className="dock-nav-btn flex-1"
        >
          <span className="text-[19px] leading-none">🎟️</span>
          <span className="text-[9.5px] font-black tracking-tight">Promo</span>
        </button>
      </nav>
    </div>
  );
}