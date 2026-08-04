export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';

const SAMPLE_MOVERS = [
  {
    protocol: 'Aerodrome',
    category: 'Dexes',
    chains: ['Base'],
    tvl_usd: 850000000,
    base_tvl_usd: 850000000,
    change_1d_pct: 12.4,
    change_7d_pct: 35.2,
  },
  {
    protocol: 'Aave V3',
    category: 'Lending',
    chains: ['Ethereum', 'Base', 'Arbitrum', 'Polygon'],
    tvl_usd: 12500000000,
    base_tvl_usd: 420000000,
    change_1d_pct: 8.7,
    change_7d_pct: 15.4,
  },
  {
    protocol: 'Uniswap V3',
    category: 'Dexes',
    chains: ['Ethereum', 'Base', 'Arbitrum', 'Optimism'],
    tvl_usd: 5400000000,
    base_tvl_usd: 310000000,
    change_1d_pct: 6.2,
    change_7d_pct: 11.8,
  },
  {
    protocol: 'Morpho Blue',
    category: 'Lending',
    chains: ['Ethereum', 'Base'],
    tvl_usd: 1200000000,
    base_tvl_usd: 95000000,
    change_1d_pct: 18.9,
    change_7d_pct: 42.1,
  },
  {
    protocol: 'Moonwell',
    category: 'Lending',
    chains: ['Base', 'Moonbeam', 'Moonriver'],
    tvl_usd: 150000000,
    base_tvl_usd: 120000000,
    change_1d_pct: -3.5,
    change_7d_pct: 8.4,
  },
  {
    protocol: 'Seamless Protocol',
    category: 'Lending',
    chains: ['Base'],
    tvl_usd: 65000000,
    base_tvl_usd: 65000000,
    change_1d_pct: 14.1,
    change_7d_pct: 28.6,
  },
  {
    protocol: 'Extra Finance',
    category: 'Yield',
    chains: ['Base', 'Optimism'],
    tvl_usd: 60000000,
    base_tvl_usd: 45000000,
    change_1d_pct: 22.3,
    change_7d_pct: 51.0,
  },
  {
    protocol: 'Compound V3',
    category: 'Lending',
    chains: ['Ethereum', 'Base', 'Arbitrum'],
    tvl_usd: 3200000000,
    base_tvl_usd: 180000000,
    change_1d_pct: 2.1,
    change_7d_pct: 5.8,
  },
  {
    protocol: 'BaseSwap',
    category: 'Dexes',
    chains: ['Base'],
    tvl_usd: 25000000,
    base_tvl_usd: 25000000,
    change_1d_pct: -5.4,
    change_7d_pct: -2.1,
  },
  {
    protocol: 'Alien Base',
    category: 'Dexes',
    chains: ['Base'],
    tvl_usd: 18000000,
    base_tvl_usd: 18000000,
    change_1d_pct: 9.8,
    change_7d_pct: 19.3,
  },
];

export const GET = withPayment('/api/defi/tvl-movers', 'Top Base TVL Protocol Movers', async (req: Request) => {
  const url = new URL(req.url);
  const isDemo = url.searchParams.get('demo') === 'true';

  if (isDemo) {
    return NextResponse.json({
      network: 'base',
      source: 'DefiLlama',
      data_source: 'demo',
      demo: true,
      note: 'Sample data — pay 0.10 USDC to get live Base TVL protocol movers.',
      top_movers_by_1d_change: SAMPLE_MOVERS,
      count: SAMPLE_MOVERS.length,
      queried_at: new Date().toISOString(),
    });
  }

  let moversData = SAMPLE_MOVERS;

  try {
    const res = await fetchWithTimeout('https://api.llama.fi/protocols', {}, 8000);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        const baseProtocols = json.filter((p: any) => {
          if (!p.chains || !Array.isArray(p.chains)) return false;
          return p.chains.some((c: string) => c.toLowerCase() === 'base') || (p.chainTvls && p.chainTvls.Base);
        });

        baseProtocols.sort((a: any, b: any) => Math.abs(b.change_1d || 0) - Math.abs(a.change_1d || 0));

        moversData = baseProtocols.slice(0, 10).map((p: any) => ({
          protocol: p.name || 'Unknown',
          category: p.category || 'DeFi',
          chains: p.chains || ['Base'],
          tvl_usd: p.tvl || 0,
          base_tvl_usd: p.chainTvls?.Base || p.tvl || 0,
          change_1d_pct: p.change_1d || 0,
          change_7d_pct: p.change_7d || 0,
        }));
      }
    }
  } catch (err) {
    console.error('DefiLlama TVL movers fetch error:', err);
  }

  return NextResponse.json({
    network: 'base',
    source: 'DefiLlama',
    data_source: 'fresh',
    top_movers_by_1d_change: moversData,
    count: moversData.length,
    queried_at: new Date().toISOString(),
  });
});
