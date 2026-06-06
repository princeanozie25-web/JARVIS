import type { Metadata } from "next";
import { JetBrains_Mono, Orbitron, Rajdhani } from "next/font/google";

import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jarvis-display",
  weight: ["400", "500", "600", "700", "800"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jarvis-body",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jarvis-mono",
  weight: ["400", "500", "600", "700"],
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
      className={`${orbitron.variable} ${rajdhani.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
