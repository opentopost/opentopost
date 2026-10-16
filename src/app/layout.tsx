import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { SITE } from "@/lib/site";
import { Tracker } from "@/components/tracker";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.creator.name, url: SITE.creator.url }],
  creator: SITE.creator.name,
  keywords: [
    "LinkedIn content tool",
    "LinkedIn post ideas",
    "employee advocacy",
    "AI LinkedIn writer",
    "team LinkedIn posts",
    "open source",
    "bring your own key",
    "Claude",
    "self-hosted",
  ],
  openGraph: { type: "website", siteName: SITE.name, locale: "en_US" },
  twitter: { card: "summary_large_image", creator: SITE.creator.x },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f1f0ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
        </Providers>
        <Suspense fallback={null}>
          <Tracker />
        </Suspense>
      </body>
    </html>
  );
}
