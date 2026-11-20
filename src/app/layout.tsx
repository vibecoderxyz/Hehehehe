import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muhammad Saqib | 3D Liquid Glass Control Center & Cyber Hub",
  description:
    "Smart short links with consent-based visitor analytics; optional camera and GPS capture require explicit visitor opt-in.",
  applicationName: "Supashort Control Center",
  authors: [{ name: "Muhammad Saqib" }],
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
  openGraph: {
    title: "3D Liquid Glass Control Center & Cyber Hub",
    description:
      "Shorten links, add optional social verification, and let visitors choose whether to share analytics, camera or GPS.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#e6e2d8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Fredoka:wght@500;600;700&display=swap"
        />
      </head>
      <body className="antialiased selection:bg-amber-300 selection:text-zinc-900 relative">
        {children}
      </body>
    </html>
  );
}
