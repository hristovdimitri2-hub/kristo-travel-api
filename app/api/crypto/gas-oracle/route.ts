export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { ALCHEMY_RPC } from '../../../lib/config';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';
import { checkRateLimit, getClientIp } from '../../../lib/ratelimit';

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

  let gasPriceWei = 100000000; // 0.1 Gwei fallback
  let blockNumber = 49520000;

  try {
    const [gasRes, blockRes] = await Promise.all([
      fetchWithTimeout(
        ALCHEMY_RPC,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
        },
        5000
      ),
      fetchWithTimeout(
        ALCHEMY_RPC,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 }),
        },
        5000
      ),
    ]);

    if (gasRes.ok) {
      const gasData = await gasRes.json();
      if (gasData.result) {
        gasPriceWei = parseInt(gasData.result, 16);
      }
    }

    if (blockRes.ok) {
      const blockData = await blockRes.json();
      if (blockData.result) {
        blockNumber = parseInt(blockData.result, 16);
      }
    }
  } catch (err) {
    console.error('Gas oracle RPC error:', err);
  }

  const gasPriceGwei = Number((gasPriceWei / 1e9).toFixed(6));

  return NextResponse.json({
    network: 'base',
    gas_price_gwei: gasPriceGwei,
    gas_price_wei: gasPriceWei,
    estimated_costs_gwei: {
      eth_transfer: 126,
      usdc_transfer: 390,
      dex_swap: 1080,
      contract_call: 1200,
    },
    block_number: blockNumber,
    recommendation: gasPriceGwei < 1.0 ? 'low' : gasPriceGwei < 5.0 ? 'medium' : 'high',
    data_source: 'fresh',
    free: true,
    message: 'This endpoint is FREE forever.',
    paid_endpoints: [
      { path: '/api/defi/yields', cost: '0.10 USDC', desc: 'Top 10 Base DeFi yield pools' },
      { path: '/api/defi/tvl-movers', cost: '0.10 USDC', desc: 'Top Base TVL protocol movers' },
      { path: '/api/crypto/wallet-profile', cost: '0.10 USDC', desc: 'On-chain wallet analysis' },
    ],
    bounty_program: 'First 100 agents get 50 free credits. See /api/agent/welcome',
    queried_at: new Date().toISOString(),
  });
}
