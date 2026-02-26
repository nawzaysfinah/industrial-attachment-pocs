import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Mono } from "next/font/google";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Industrial Attachment POCs",
  description: "Local-first SME AI consultant workflow with Ollama and GraphRAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${spaceMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
