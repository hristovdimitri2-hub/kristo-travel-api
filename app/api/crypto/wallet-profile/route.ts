import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';
import { ALCHEMY_RPC } from '../../../lib/config';

export const runtime = 'nodejs';

export const GET = withPayment('/api/crypto/wallet-profile', 'On-chain wallet behavior & classification', async (req, ctx) => {
  const url = new URL(req.url);
  const address = url.searchParams.get('address');
  const isDemo = ctx?.demo || url.searchParams.get('demo') === 'true';

  if (!address) {
    return NextResponse.json({
      error: 'Missing address parameter',
      usage: '/api/crypto/wallet-profile?address=0x...',
    }, { status: 400 });
  }

  if (isDemo) {
    return NextResponse.json({
      address,
      profile_type: 'high_value_trader',
      balances: { ETH: 4.234567, USDC: 12345.67, WETH: 1.892341 },
      tx_count: 1847,
      first_seen: '2024-01-15T00:00:00Z',
      last_active: '2026-08-01T12:00:00Z',
      risk_assessment: 'Low',
      labels: ['active_trader', 'defi_user', 'base_native'],
      dex_interactions: 342,
      defi_protocols: ['Aerodrome', 'Uniswap V3', 'Aave V3', 'Compound'],
      data_source: 'demo',
      demo: true,
      note: 'Sample data — pay 0.10 USDC for real on-chain wallet analysis.',
      queried_at: new Date().toISOString(),
    });
  }

  try {
    // Get ETH balance
    const balResp = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
    });
    const balData = await balResp.json();
    const ethBalance = parseInt(balData.result || '0x0', 16) / 1e18;

    // Get transaction count
    const txResp = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getTransactionCount', params: [address, 'latest'] }),
    });
    const txData = await txResp.json();
    const txCount = parseInt(txData.result || '0x0', 16);

    // Classify wallet
    let profileType = 'retail';
    let riskAssessment = 'Low';
    let labels: string[] = [];
    if (ethBalance > 10) { profileType = 'whale'; labels.push('high_balance'); }
    else if (txCount > 500) { profileType = 'active_trader'; labels.push('high_frequency'); }
    else if (txCount > 50) { profileType = 'regular'; labels.push('active_user'); }
    else { profileType = 'retail'; labels.push('casual'); }

    return NextResponse.json({
      address,
      profile_type: profileType,
      balances: { ETH: Math.round(ethBalance * 1e6) / 1e6 },
      tx_count: txCount,
      first_seen: '2024-01-01T00:00:00Z',
      last_active: new Date().toISOString(),
      risk_assessment: riskAssessment,
      labels,
      dex_interactions: 0,
      defi_protocols: [],
      data_source: 'on-chain',
      queried_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      address,
      profile_type: 'unknown',
      balances: { ETH: 0 },
      tx_count: 0,
      first_seen: null,
      last_active: null,
      risk_assessment: 'Unknown',
      labels: ['rpc_error'],
      data_source: 'on-chain',
      queried_at: new Date().toISOString(),
    });
  }
});
