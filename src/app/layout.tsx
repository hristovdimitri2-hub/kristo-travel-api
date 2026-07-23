import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kristo Travel Intelligence | x402 Dashboard",
  description: "Pay-per-call travel data API dashboard. Monitor USDC payments on Base network.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
