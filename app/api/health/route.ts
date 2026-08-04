export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { ALCHEMY_RPC, WALLET_ADDRESS } from '../../lib/config';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout';

export async function GET() {
  let blockNumber = 49520000;
  let web3Connected = false;

  try {
    const res = await fetchWithTimeout(
      ALCHEMY_RPC,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      },
      5000
    );

    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        blockNumber = parseInt(data.result, 16);
        web3Connected = true;
      }
    }
  } catch (err) {
    console.error('Health endpoint RPC error:', err);
  }

  return NextResponse.json({
    status: 'online',
    web3_connected: web3Connected,
    wallet: WALLET_ADDRESS,
    network: 'base',
    rpc_endpoints: 2,
    rpc_primary: ALCHEMY_RPC,
    block: blockNumber,
    total_sales: 0,
    timestamp: new Date().toISOString(),
  });
}
