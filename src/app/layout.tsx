import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/layout/Shell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "DHH Pulse — Desi Hip Hop stream intelligence",
    template: "%s · DHH Pulse",
  },
  description:
    "Daily stream, monthly listener, and catalog intelligence for the Desi Hip Hop scene. Snapshot deltas computed from Spotify's web player layer.",
  applicationName: "DHH Pulse",
  keywords: [
    "Desi Hip Hop",
    "Spotify streams",
    "monthly listeners",
    "leaderboard",
    "KR$NA",
    "Seedhe Maut",
    "DIVINE",
  ],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#08080A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-pitch font-sans text-chalk antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
