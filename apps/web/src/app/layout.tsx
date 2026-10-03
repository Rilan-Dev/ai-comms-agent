import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ai-comms-agent",
  description: "Multi-channel AI communications agent",
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
