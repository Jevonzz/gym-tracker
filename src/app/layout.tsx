import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/bottom-nav";
import { RestTimerBar } from "@/components/rest-timer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Lift — Gym Tracker", template: "%s · Lift" },
  description: "Log workouts, track PRs and see your progress. Works offline.",
  applicationName: "Lift",
  appleWebApp: { capable: true, title: "Lift", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0e12" },
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <Providers>
          <main className="mx-auto w-full max-w-lg px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</main>
          <RestTimerBar />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
