"use client";

/** Small labelled toggle card used by the "Quick Verification Toggles" grid. */
export function ToggleCard({
  active,
  onToggle,
  tone,
  icon,
  title,
  subtitle,
  onLabel = "Enabled",
  offLabel = "Disabled",
}: {
  active: boolean;
  onToggle: () => void;
  tone: "blue" | "green";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onLabel?: string;
  offLabel?: string;
}) {
  const dot = tone === "blue" ? "from-sky-400 to-blue-700" : "from-emerald-400 to-teal-700";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`group relative w-full text-left p-3 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] cursor-pointer overflow-hidden ${
        active
          ? "bg-white/85 border-blue-400/70 shadow-[0_8px_20px_-8px_rgba(37,60,175,0.55)]"
          : "bg-white/45 border-white/80 hover:bg-white/70"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${dot} ${
            active ? "" : "opacity-45 grayscale"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold text-zinc-900 leading-tight">{title}</p>
          <p className="text-[10px] font-semibold text-zinc-500 leading-tight mt-0.5 truncate">
            {subtitle}
          </p>
        </div>
        <span
          className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${
            active ? "bg-emerald-500" : "bg-zinc-300"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              active ? "left-[1.15rem]" : "left-0.5"
            }`}
          />
        </span>
      </div>
      <p
        className={`mt-1.5 text-[9.5px] font-black uppercase tracking-wider ${
          active ? "text-emerald-700" : "text-zinc-400"
        }`}
      >
        {active ? onLabel : offLabel}
      </p>
    </button>
  );
}