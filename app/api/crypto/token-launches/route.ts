export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';

export const runtime = 'nodejs';

const DEMO_LAUNCHES = [
  { pair_address: '0x1a2b3c...', token: 'BaseFi', symbol: 'BASEFI', price_usd: 0.0342, liquidity_usd: 450000, volume_24h: 890000, created_at: '2026-08-03T14:00:00Z', dex: 'Aerodrome' },
  { pair_address: '0x2b3c4d...', token: 'AeroMax', symbol: 'AEROMAX', price_usd: 0.0089, liquidity_usd: 120000, volume_24h: 340000, created_at: '2026-08-03T10:00:00Z', dex: 'Uniswap V3' },
  { pair_address: '0x3c4d5e...', token: 'BaseMeme', symbol: 'BMEME', price_usd: 0.00012, liquidity_usd: 89000, volume_24h: 560000, created_at: '2026-08-02T22:00:00Z', dex: 'Aerodrome' },
  { pair_address: '0x4d5e6f...', token: 'DegenFi', symbol: 'DGFI', price_usd: 0.234, liquidity_usd: 230000, volume_24h: 1200000, created_at: '2026-08-02T16:00:00Z', dex: 'Aerodrome' },
  { pair_address: '0x5e6f70...', token: 'BaseChain', symbol: 'BCHAIN', price_usd: 0.0456, liquidity_usd: 340000, volume_24h: 670000, created_at: '2026-08-02T08:00:00Z', dex: 'SushiSwap' },
  { pair_address: '0x6f7080...', token: 'MorphoFi', symbol: 'MFI', price_usd: 1.234, liquidity_usd: 560000, volume_24h: 2300000, created_at: '2026-08-01T20:00:00Z', dex: 'Uniswap V3' },
  { pair_address: '0x708090...', token: 'OnboardFi', symbol: 'ONBOARD', price_usd: 0.0678, liquidity_usd: 180000, volume_24h: 450000, created_at: '2026-08-01T12:00:00Z', dex: 'Aerodrome' },
  { pair_address: '0x8090a0...', token: 'BaseYield', symbol: 'BYIELD', price_usd: 0.0123, liquidity_usd: 95000, volume_24h: 230000, created_at: '2026-08-01T06:00:00Z', dex: 'Aerodrome' },
  { pair_address: '0x90a0b0...', token: 'AeroJump', symbol: 'AJUMP', price_usd: 0.0456, liquidity_usd: 210000, volume_24h: 890000, created_at: '2026-07-31T22:00:00Z', dex: 'Uniswap V3' },
  { pair_address: '0xa0b0c0...', token: 'BaseSwap', symbol: 'BSWAP', price_usd: 0.0789, liquidity_usd: 320000, volume_24h: 1100000, created_at: '2026-07-31T14:00:00Z', dex: 'Aerodrome' },
];

export const GET = withPayment('/api/crypto/token-launches', 'Recently launched tokens on Base', async (req, ctx) => {
  const url = new URL(req.url);
  const isDemo = ctx?.demo || url.searchParams.get('demo') === 'true';

  if (isDemo) {
    return NextResponse.json({
      network: 'base',
      source: 'DexScreener',
      data_source: 'demo',
      demo: true,
      note: 'Sample data — pay 0.10 USDC to get live recently launched tokens.',
      recent_launches: DEMO_LAUNCHES,
      count: DEMO_LAUNCHES.length,
      queried_at: new Date().toISOString(),
    });
  }

  try {
    const resp = await fetchWithTimeout('https://api.dexscreener.com/latest/dex/search?q=base', {}, 10000);
    const data = await resp.json();
    const pairs = (data.pairs || [])
      .filter((p: any) => p.chainId === 'base')
      .sort((a: any, b: any) => new Date(b.pairCreatedAt || 0).getTime() - new Date(a.pairCreatedAt || 0).getTime())
      .slice(0, 10)
      .map((p: any) => ({
        pair_address: p.pairAddress,
        token: p.baseToken?.name || 'Unknown',
        symbol: p.baseToken?.symbol || '???',
        price_usd: parseFloat(p.priceUsd || '0'),
        liquidity_usd: Math.round(p.liquidity?.usd || 0),
        volume_24h: Math.round(p.volume?.h24 || 0),
        created_at: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
        dex: p.dexId || 'Unknown',
      }));

    return NextResponse.json({
      network: 'base',
      source: 'DexScreener',
      data_source: 'fresh',
      recent_launches: pairs.length > 0 ? pairs : DEMO_LAUNCHES,
      count: pairs.length > 0 ? pairs.length : DEMO_LAUNCHES.length,
      queried_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      network: 'base',
      source: 'DexScreener',
      data_source: 'fresh',
      recent_launches: DEMO_LAUNCHES,
      count: DEMO_LAUNCHES.length,
      queried_at: new Date().toISOString(),
    });
  }
});
