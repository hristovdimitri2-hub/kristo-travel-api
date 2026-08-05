import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kristo Intelligence — x402 API Dashboard",
  description: "Pay-per-call DeFi intelligence API for AI agents on Base blockchain",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0052ff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0e1a] text-white antialiased">{children}</body>
    </html>
  );
}
