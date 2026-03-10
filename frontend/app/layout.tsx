import type { Metadata } from "next";
import { Literata, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = Literata({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "DubbAI",
  description: "AI dubbing workspace for transcript, translation, diarization, and export."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${display.variable} ${body.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="bg-transparent font-[family-name:var(--font-body)] text-ink">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
