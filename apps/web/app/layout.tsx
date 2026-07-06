import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "termlyrics",
  description: "Live, time-synced karaoke-style lyrics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
