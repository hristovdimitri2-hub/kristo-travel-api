export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';

const SAMPLE_LENDING = [
  {
    pool: 'aave-v3-usdc-base',
    project: 'Aave V3',
    asset: 'USDC',
    tvl_usd: 150000000,
    apy_pct: 5.2,
    borrow_rate_pct: 6.8,
    type: 'lending',
  },
  {
    pool: 'aave-v3-weth-base',
    project: 'Aave V3',
    asset: 'WETH',
    tvl_usd: 110000000,
    apy_pct: 2.1,
    borrow_rate_pct: 3.4,
    type: 'lending',
  },
  {
    pool: 'compound-v3-usdc-base',
    project: 'Compound V3',
    asset: 'USDC',
    tvl_usd: 62000000,
    apy_pct: 4.8,
    borrow_rate_pct: 6.1,
    type: 'lending',
  },
  {
    pool: 'morpho-blue-usdc-base',
    project: 'Morpho Blue',
    asset: 'USDC',
    tvl_usd: 45000000,
    apy_pct: 6.8,
    borrow_rate_pct: 7.9,
    type: 'lending',
  },
  {
    pool: 'moonwell-usdc-base',
    project: 'Moonwell',
    asset: 'USDC',
    tvl_usd: 38000000,
    apy_pct: 7.5,
    borrow_rate_pct: 9.2,
    type: 'lending',
  },
  {
    pool: 'moonwell-weth-base',
    project: 'Moonwell',
    asset: 'WETH',
    tvl_usd: 24000000,
    apy_pct: 1.9,
    borrow_rate_pct: 3.1,
    type: 'lending',
  },
  {
    pool: 'seamless-usdc-base',
    project: 'Seamless',
    asset: 'USDC',
    tvl_usd: 28000000,
    apy_pct: 8.2,
    borrow_rate_pct: 10.4,
    type: 'lending',
  },
  {
    pool: 'seamless-cbeth-base',
    project: 'Seamless',
    asset: 'cbETH',
    tvl_usd: 15000000,
    apy_pct: 3.4,
    borrow_rate_pct: 4.8,
    type: 'lending',
  },
  {
    pool: 'aave-v3-cbeth-base',
    project: 'Aave V3',
    asset: 'cbETH',
    tvl_usd: 32000000,
    apy_pct: 2.8,
    borrow_rate_pct: 4.1,
    type: 'lending',
  },
  {
    pool: 'compound-v3-weth-base',
    project: 'Compound V3',
    asset: 'WETH',
    tvl_usd: 19000000,
    apy_pct: 1.7,
    borrow_rate_pct: 2.9,
    type: 'lending',
  },
];

export const GET = withPayment('/api/defi/lending-rates', 'Base Lending & Borrow Rates', async (req: Request) => {
  const url = new URL(req.url);
  const isDemo = url.searchParams.get('demo') === 'true';

  if (isDemo) {
    return NextResponse.json({
      network: 'base',
      source: 'DefiLlama',
      data_source: 'demo',
      demo: true,
      note: 'Sample data — pay 0.10 USDC to get live Base lending rates.',
      lending_pools: SAMPLE_LENDING,
      count: SAMPLE_LENDING.length,
      queried_at: new Date().toISOString(),
    });
  }

  let lendingData = SAMPLE_LENDING;

  try {
    const res = await fetchWithTimeout('https://yields.llama.fi/pools', {}, 8000);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data)) {
        const lendingKeywords = ['lending', 'aave', 'compound', 'morpho', 'moonwell', 'seamless'];
        const baseLending = json.data.filter((p: any) => {
          if (!p.chain || p.chain.toLowerCase() !== 'base') return false;
          const category = (p.category || '').toLowerCase();
          const project = (p.project || '').toLowerCase();
          return lendingKeywords.some((k) => category.includes(k) || project.includes(k));
        });

        baseLending.sort((a: any, b: any) => (b.tvlUsd || 0) - (a.tvlUsd || 0));

        if (baseLending.length > 0) {
          lendingData = baseLending.slice(0, 10).map((p: any) => ({
            pool: p.pool || p.symbol || 'unknown',
            project: p.project || 'Unknown',
            asset: p.symbol || 'USDC',
            tvl_usd: p.tvlUsd || 0,
            apy_pct: p.apy || 0,
            borrow_rate_pct: p.apyBaseBorrow || p.apyBorrow || 0,
            type: 'lending',
          }));
        }
      }
    }
  } catch (err) {
    console.error('DefiLlama lending rates fetch error:', err);
  }

  return NextResponse.json({
    network: 'base',
    source: 'DefiLlama',
    data_source: 'fresh',
    lending_pools: lendingData,
    count: lendingData.length,
    queried_at: new Date().toISOString(),
  });
});
