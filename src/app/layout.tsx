import Script from "next/script";

import "./globals.css";

import { ConditionalFooter } from "@/shared/ui/footer/ConditionalFooter";
import { Header } from "@/shared/ui/header/Header";

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
    // suppressHydrationWarning is required here (and only here - it does
    // not cascade to children) because the anti-FOUC script below sets
    // `data-theme` on this element before React hydrates, which would
    // otherwise be flagged as a server/client attribute mismatch.
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
