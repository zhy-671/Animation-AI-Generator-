import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast-notification";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Animation AI Generator & Video Maker | Animaker AI | Create 2D & 3D Animations",
  description: "Create stunning animated videos with our AI-powered 2D and 3D animation tools. Optimized for short-form video creators on TikTok, Reels, and more. Try Animation AI Generator free today!",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    shortcut: "/images/favicon.ico",
    apple: "/images/logo.png",
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

