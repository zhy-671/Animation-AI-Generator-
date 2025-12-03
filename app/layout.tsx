import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast-notification";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // Base URL for all absolute URLs (canonical, OG, etc.)
  metadataBase: new URL("https://videoaimusic.com"),
  title: "Video AI Music – Create Music Videos from Your Songs Online",
  description:
    "Create stunning music videos in minutes with AI! Transform songs into visually synced videos with lip sync and cinematic styles.",
  keywords: [
    "AI music video creation",
    "lip sync videos",
    "music to video",
    "auto storyboard",
    "professional music video quality",
    "cinematic storyboards",
    "video styles for music",
    "export and share music videos",
  ],
  // Canonical URL for SEO
  alternates: {
    canonical: "/",
  },
  // Robots meta directive (will render <meta name=\"robots\" ...>)
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    // Ensure favicon is exposed in SSR <head>
    icon: [
      // Standard favicon path some scanners expect
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/versemovie-logo.png", sizes: "32x32", type: "image/png" },
      { url: "/images/versemovie-logo.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/images/versemovie-logo.png",
    apple: "/images/versemovie-logo.png",
  },
  other: {
    "msvalidate.01": "79CD94EF4920CFF609CE443B3ADE8DA1",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S03WZ8DVK1"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-S03WZ8DVK1');
          `}
        </Script>
        
        {/* TikTok Pixel Code */}
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
            var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
            ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('D4JBK73C77UCLPL6Q2SG');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

