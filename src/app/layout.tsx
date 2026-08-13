import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

import "./globals.css";

import { CompanionButton } from "@/features/companion/CompanionButton";
import { ModeSwitcher } from "@/features/progress-tracker/components/ModeSwitcher";
import { ProfileSwitcher } from "@/features/progress-tracker/components/ProfileSwitcher";
import { ConditionalFooter } from "@/shared/ui/footer/ConditionalFooter";
import { GameDataStatusBanner } from "@/shared/ui/game-data-banner/GameDataStatusBanner";
import { Header } from "@/shared/ui/header/Header";
import { SiteStatusBanner } from "@/shared/ui/site-status-banner/SiteStatusBanner";

import { fontVariables } from "./fonts";
import { Providers } from "./providers";
import { themeInitScript } from "./theme-init-script";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TarkovGuides",
  description: "Community guides, trackers, and tools for Escape from Tarkov.",
};

/** Root HTML shell shared by every route; loads the site fonts and global styles. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is required here (and only here; it does
    // not cascade to children) because the anti-FOUC script below sets
    // `data-theme` on this element before React hydrates, which would
    // otherwise be flagged as a server/client attribute mismatch.
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      {/* suppressHydrationWarning here too: some browser extensions/preview
          tooling inject a class onto <body> before React hydrates (e.g. the
          "vc-init" class seen in dev), which React would otherwise flag as a
          mismatch even though it's outside this app's control. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>
          <Header
            beforeThemePicker={<CompanionButton />}
            afterThemePicker={
              <>
                <ModeSwitcher />
                <ProfileSwitcher />
              </>
            }
          />
          <SiteStatusBanner />
          <GameDataStatusBanner />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
