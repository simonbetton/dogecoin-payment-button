import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const dogeSans = localFont({
  display: "swap",
  src: [
    {
      path: "./fonts/DogeSans-Normal.otf",
      style: "normal",
      weight: "400",
    },
    {
      path: "./fonts/DogeSans-Italic.otf",
      style: "italic",
      weight: "400",
    },
  ],
  variable: "--font-doge-sans",
});

export const metadata: Metadata = {
  description:
    "Installable shadcn registry block for BIP44 Dogecoin payment address discovery.",
  icons: {
    apple: [
      { sizes: "57x57", url: "/apple-icon-57x57.png" },
      { sizes: "60x60", url: "/apple-icon-60x60.png" },
      { sizes: "72x72", url: "/apple-icon-72x72.png" },
      { sizes: "76x76", url: "/apple-icon-76x76.png" },
      { sizes: "114x114", url: "/apple-icon-114x114.png" },
      { sizes: "120x120", url: "/apple-icon-120x120.png" },
      { sizes: "144x144", url: "/apple-icon-144x144.png" },
      { sizes: "152x152", url: "/apple-icon-152x152.png" },
      { sizes: "180x180", url: "/apple-icon-180x180.png" },
    ],
    icon: [
      {
        sizes: "192x192",
        type: "image/png",
        url: "/android-icon-192x192.png",
      },
      { sizes: "32x32", type: "image/png", url: "/favicon-32x32.png" },
      { sizes: "96x96", type: "image/png", url: "/favicon-96x96.png" },
      { sizes: "16x16", type: "image/png", url: "/favicon-16x16.png" },
    ],
  },
  manifest: "/manifest.json",
  other: {
    "msapplication-TileColor": "#ffffff",
    "msapplication-TileImage": "/ms-icon-144x144.png",
  },
  title: "Dogecoin Payment Button",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "#ffffff", media: "(prefers-color-scheme: light)" },
    { color: "#252525", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${dogeSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
