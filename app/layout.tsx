import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";

import "./globals.css";

const fraunces = localFont({
  src: [
    {
      path: "./fonts/Fraunces-Regular-300.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/Fraunces-Regular-400.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Fraunces-Regular-500.ttf",
      weight: "500",
      style: "normal",
    },
    { path: "./fonts/Fraunces-Italic-300.ttf", weight: "300", style: "italic" },
    { path: "./fonts/Fraunces-Italic-400.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-jarvis-display",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-300.ttf", weight: "300", style: "normal" },
    { path: "./fonts/JetBrainsMono-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/JetBrainsMono-500.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-jarvis-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JARVIS",
  description: "Personal AI operating environment for Prince Anozie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jetbrainsMono.variable} ${GeistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
