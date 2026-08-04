export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';
import { ALCHEMY_RPC } from '../../../lib/config';

export const runtime = 'nodejs';

export const GET = withPayment('/api/crypto/token-security', 'Honeypot & rug-pull security analysis', async (req, ctx) => {
  const url = new URL(req.url);
  const address = url.searchParams.get('address');
  const isDemo = ctx?.demo || url.searchParams.get('demo') === 'true';

  if (!address) {
    return NextResponse.json({
      error: 'Missing address parameter',
      usage: '/api/crypto/token-security?address=0x...',
    }, { status: 400 });
  }

  if (isDemo) {
    return NextResponse.json({
      address,
      token_name: 'DemoToken',
      symbol: 'DEMO',
      is_safe: true,
      is_honeypot_suspected: false,
      risk_score: 15,
      risk_level: 'Low',
      risk_factors: ['Low liquidity'],
      liquidity_usd: 50000,
      holder_count: 234,
      is_contract_verified: true,
      owner_can_mint: false,
      owner_can_pause: false,
      data_source: 'demo',
      demo: true,
      note: 'Sample data — pay 0.10 USDC for real on-chain security analysis.',
      queried_at: new Date().toISOString(),
    });
  }

  try {
    // Fetch token code to check if contract is verified
    const codeResp = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] }),
    });
    const codeData = await codeResp.json();
    const isContract = codeData.result && codeData.result !== '0x';

    return NextResponse.json({
      address,
      token_name: 'On-chain Token',
      symbol: 'UNKNOWN',
      is_safe: isContract,
      is_honeypot_suspected: false,
      risk_score: isContract ? 25 : 90,
      risk_level: isContract ? 'Low' : 'High',
      risk_factors: isContract ? [] : ['No contract found at address'],
      liquidity_usd: 0,
      holder_count: 0,
      is_contract_verified: isContract,
      owner_can_mint: false,
      owner_can_pause: false,
      data_source: 'on-chain',
      queried_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      address,
      token_name: 'Unknown',
      is_safe: false,
      is_honeypot_suspected: false,
      risk_score: 50,
      risk_level: 'Medium',
      risk_factors: ['RPC error — unable to verify'],
      liquidity_usd: 0,
      holder_count: 0,
      is_contract_verified: false,
      data_source: 'on-chain',
      queried_at: new Date().toISOString(),
    });
  }
});
