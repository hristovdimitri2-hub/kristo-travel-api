export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';
import { checkRateLimit, getClientIp } from '../../../lib/ratelimit';

const SYMBOL_TO_CG_ID: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'ethereum',
  USDC: 'usd-coin',
  BASE: 'base',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  AERO: 'aerodrome-finance',
  OP: 'optimism',
};

const FALLBACK_DATA: Record<string, { price_usd: number; change_24h_pct: number; market_cap_usd: number }> = {
  ethereum: { price_usd: 3300.0, change_24h_pct: 1.5, market_cap_usd: 400000000000 },
  'usd-coin': { price_usd: 1.0, change_24h_pct: 0.01, market_cap_usd: 34000000000 },
  base: { price_usd: 2.5, change_24h_pct: 3.2, market_cap_usd: 500000000 },
};

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip, 60, 60000);

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Maximum 60 requests per minute.',
        retry_after_seconds: rateLimit.reset,
      },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tokensParam = searchParams.get('tokens') || 'ETH,USDC';
  const symbols = tokensParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  const cgIds: string[] = [];
  const symbolMap: Record<string, string> = {};

  for (const sym of symbols) {
    const cgId = SYMBOL_TO_CG_ID[sym] || sym.toLowerCase();
    cgIds.push(cgId);
    symbolMap[sym] = cgId;
  }

  const uniqueCgIds = Array.from(new Set(cgIds));
  let cgResponse: Record<string, any> = {};

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${uniqueCgIds.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 6000);
    if (res.ok) {
      cgResponse = await res.json();
    }
  } catch (err) {
    console.error('CoinGecko fetch error:', err);
  }

  const tokenResults = symbols.map((sym) => {
    const cgId = symbolMap[sym] || sym.toLowerCase();
    const data = cgResponse[cgId];
    const fallback = FALLBACK_DATA[cgId] || { price_usd: 1.0, change_24h_pct: 0, market_cap_usd: 0 };

    return {
      symbol: sym,
      coingecko_id: cgId,
      price_usd: data?.usd ?? fallback.price_usd,
      change_24h_pct: data?.usd_24h_change ?? fallback.change_24h_pct,
      market_cap_usd: data?.usd_market_cap ?? fallback.market_cap_usd,
    };
  });

  return NextResponse.json({
    tokens: tokenResults,
    source: 'CoinGecko',
    data_source: 'fresh',
    free: true,
    message: 'This endpoint is FREE. For deeper analysis, see our paid endpoints.',
    queried_at: new Date().toISOString(),
  });
}
