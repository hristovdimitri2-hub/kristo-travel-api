import { NextResponse } from 'next/server';
import {
  WALLET_ADDRESS,
  USDC_ADDRESS,
  CHAIN_ID,
  PRICE_USDC,
  PRICE_RAW,
  TRIAL_CREDITS,
  VOLUME_DISCOUNT_THRESHOLD,
  VOLUME_DISCOUNT_PRICE_RAW,
} from '@/app/lib/config';

export const dynamic = 'force-static';

export async function GET() {
  const manifest = {
    $schema: 'https://x402.org/schemas/manifest-v2.json',
    x402_version: 2,
    service: {
      name: 'Kristo Intelligence',
      version: '5.0.0',
      description:
        'Base-chain DeFi & on-chain intelligence API for AI agents. Real-time yields, TVL, prices, wallet analysis.',
      url: 'https://kristo-intelligence.vercel.app',
      openapi_url: 'https://kristo-intelligence.vercel.app/openapi.json',
      mcp_url: 'https://kristo-intelligence.vercel.app/mcp',
      ai_plugin_url:
        'https://kristo-intelligence.vercel.app/.well-known/ai-plugin.json',
      agents_txt_url: 'https://kristo-intelligence.vercel.app/agents.txt',
      llms_txt_url: 'https://kristo-intelligence.vercel.app/llms.txt',
      stats_url: 'https://kristo-intelligence.vercel.app/api/stats/public',
      health_url: 'https://kristo-intelligence.vercel.app/api/health',
    },
    payment: {
      scheme: 'exact',
      network: 'base',
      chain_id: CHAIN_ID,
      asset: 'USDC',
      asset_contract: USDC_ADDRESS,
      amount: '0.10',
      amount_raw: PRICE_RAW,
      decimals: 6,
      recipient: WALLET_ADDRESS,
      flow: [
        '1. Call endpoint without X-PAYMENT header, receive HTTP 402 with payment details',
        '2. Send 0.10 USDC to recipient address on Base network',
        '3. Retry endpoint with X-PAYMENT: <tx_hash> header',
      ],
      trial_credits: TRIAL_CREDITS,
      volume_discount: {
        threshold_calls: VOLUME_DISCOUNT_THRESHOLD,
        price_usdc: 0.05,
        price_raw: VOLUME_DISCOUNT_PRICE_RAW,
      },
    },
    endpoints: {
      paid: [
        'defi/yields',
        'defi/tvl-movers',
        'defi/lending-rates',
        'defi/dex-pools',
        'defi/protocol-safety',
        'crypto/token-launches',
        'crypto/token-security',
        'crypto/wallet-profile',
        'crypto/whale-moves',
        'crypto/bridge-volume',
      ],
      free: [
        'api/health',
        'api/stats/public',
        'api/sales/recent',
        'api/credits',
      ],
      freemium: ['crypto/token-prices', 'crypto/gas-oracle'],
    },
  };

  return NextResponse.json(manifest);
}
