import React from 'react';

export const metadata = {
  title: 'Kristo Intelligence API',
  description: 'Pay-per-call DeFi Intelligence API on Base Blockchain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0b0f19;
            color: #f3f4f6;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
