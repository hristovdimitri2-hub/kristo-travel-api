import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#0052FF"/><text x="50" y="72" font-size="62" font-weight="bold" text-anchor="middle" fill="white" font-family="sans-serif">K</text></svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
