export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';

const SAMPLE_POOLS = [
  {
    pool: 'aave-v3-usdc',
    project: 'Aave V3',
    chain: 'Base',
    tvl_usd: 150000000,
    apy_pct: 5.2,
    apy_base_pct: 3.8,
    apy_reward_pct: 1.4,
    underlying_tokens: ['USDC'],
    reward_tokens: ['OP'],
    pool_meta: 'Supply USDC',
  },
  {
    pool: 'aerodrome-vamm-weth-usdc',
    project: 'Aerodrome',
    chain: 'Base',
    tvl_usd: 85000000,
    apy_pct: 18.5,
    apy_base_pct: 4.2,
    apy_reward_pct: 14.3,
    underlying_tokens: ['WETH', 'USDC'],
    reward_tokens: ['AERO'],
    pool_meta: 'Volatile Pool',
  },
  {
    pool: 'compound-v3-usdc',
    project: 'Compound V3',
    chain: 'Base',
    tvl_usd: 62000000,
    apy_pct: 4.8,
    apy_base_pct: 3.5,
    apy_reward_pct: 1.3,
    underlying_tokens: ['USDC'],
    reward_tokens: ['COMP'],
    pool_meta: 'Main Market',
  },
  {
    pool: 'morpho-blue-usdc-weth',
    project: 'Morpho Blue',
    chain: 'Base',
    tvl_usd: 45000000,
    apy_pct: 6.8,
    apy_base_pct: 6.8,
    apy_reward_pct: 0.0,
    underlying_tokens: ['USDC', 'WETH'],
    reward_tokens: [],
    pool_meta: 'Lending Vault',
  },
  {
    pool: 'uniswap-v3-weth-usdc',
    project: 'Uniswap V3',
    chain: 'Base',
    tvl_usd: 120000000,
    apy_pct: 22.1,
    apy_base_pct: 22.1,
    apy_reward_pct: 0.0,
    underlying_tokens: ['WETH', 'USDC'],
    reward_tokens: [],
    pool_meta: '0.05% Fee Tier',
  },
  {
    pool: 'moonwell-usdc',
    project: 'Moonwell',
    chain: 'Base',
    tvl_usd: 38000000,
    apy_pct: 7.5,
    apy_base_pct: 4.1,
    apy_reward_pct: 3.4,
    underlying_tokens: ['USDC'],
    reward_tokens: ['WELL'],
    pool_meta: 'Base USDC Supply',
  },
  {
    pool: 'seamless-cbeth',
    project: 'Seamless',
    chain: 'Base',
    tvl_usd: 28000000,
    apy_pct: 8.2,
    apy_base_pct: 3.2,
    apy_reward_pct: 5.0,
    underlying_tokens: ['cbETH'],
    reward_tokens: ['SEAM'],
    pool_meta: 'Liquid Staking Market',
  },
  {
    pool: 'extra-finance-aero-usdc',
    project: 'Extra Finance',
    chain: 'Base',
    tvl_usd: 18000000,
    apy_pct: 34.5,
    apy_base_pct: 8.5,
    apy_reward_pct: 26.0,
    underlying_tokens: ['AERO', 'USDC'],
    reward_tokens: ['EXTRA'],
    pool_meta: 'Leveraged Farming 3x',
  },
  {
    pool: 'pancakeswap-v3-weth-usdc',
    project: 'PancakeSwap V3',
    chain: 'Base',
    tvl_usd: 15000000,
    apy_pct: 19.8,
    apy_base_pct: 19.8,
    apy_reward_pct: 0.0,
    underlying_tokens: ['WETH', 'USDC'],
    reward_tokens: [],
    pool_meta: '0.05% Fee Tier',
  },
  {
    pool: 'baseswap-v3-weth-usdc',
    project: 'BaseSwap',
    chain: 'Base',
    tvl_usd: 12000000,
    apy_pct: 16.4,
    apy_base_pct: 10.2,
    apy_reward_pct: 6.2,
    underlying_tokens: ['WETH', 'USDC'],
    reward_tokens: ['BSWAP'],
    pool_meta: 'Concentrated Liquidity',
  },
];

export const GET = withPayment('/api/defi/yields', 'Top 10 Base Yield Pools', async (req: Request) => {
  const url = new URL(req.url);
  const isDemo = url.searchParams.get('demo') === 'true';

  if (isDemo) {
    return NextResponse.json({
      network: 'base',
      source: 'DefiLlama',
      data_source: 'demo',
      demo: true,
      note: 'Sample data — pay 0.10 USDC to get live top 10 Base yield pools.',
      top_pools_by_tvl: SAMPLE_POOLS,
      count: SAMPLE_POOLS.length,
      queried_at: new Date().toISOString(),
    });
  }

  let poolsData = SAMPLE_POOLS;

  try {
    const res = await fetchWithTimeout('https://yields.llama.fi/pools', {}, 8000);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data)) {
        const basePools = json.data.filter(
          (p: any) => p.chain && p.chain.toLowerCase() === 'base'
        );

        basePools.sort((a: any, b: any) => (b.tvlUsd || 0) - (a.tvlUsd || 0));

        poolsData = basePools.slice(0, 10).map((p: any) => ({
          pool: p.pool || p.symbol || 'unknown',
          project: p.project || 'Unknown',
          chain: 'Base',
          tvl_usd: p.tvlUsd || 0,
          apy_pct: p.apy || 0,
          apy_base_pct: p.apyBase || 0,
          apy_reward_pct: p.apyReward || 0,
          underlying_tokens: p.underlyingTokens || (p.symbol ? [p.symbol] : []),
          reward_tokens: p.rewardTokens || [],
          pool_meta: p.poolMeta || null,
        }));
      }
    }
  } catch (err) {
    console.error('DefiLlama yields fetch error:', err);
  }

  return NextResponse.json({
    network: 'base',
    source: 'DefiLlama',
    data_source: 'fresh',
    top_pools_by_tvl: poolsData,
    count: poolsData.length,
    queried_at: new Date().toISOString(),
  });
});
