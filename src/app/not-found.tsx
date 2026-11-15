import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative z-10 min-h-[100dvh] flex items-center justify-center p-5">
      <div className="clay-board rounded-[28px] p-8 sm:p-10 max-w-md w-full text-center">
        <div className="glass-orb orb-red w-16 h-16 mx-auto text-[26px] font-black">404</div>
        <h1 className="mt-4 text-2xl font-black text-zinc-900 tracking-tight">
          This link doesn&apos;t exist
        </h1>
        <p className="mt-1.5 text-[13px] font-semibold text-zinc-600 leading-relaxed">
          The short link you followed was removed, never created, or the alias was mistyped.
        </p>
        <Link
          href="/"
          className="glass-orb orb-blue mt-5 w-full py-3 text-[13px] font-black uppercase tracking-wider text-white inline-flex items-center justify-center"
        >
          Back to Control Center
        </Link>
      </div>
    </main>
  );
}